package com.thinkbiganalytics.spark.dataprofiler.core;

/*-
 * #%L
 * thinkbig-spark-job-profiler-spark-v2
 * %%
 * Copyright (C) 2017 ThinkBig Analytics
 * %%
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * #L%
 */

import com.thinkbiganalytics.spark.DataSet;
import com.thinkbiganalytics.spark.dataprofiler.functions.CombineModels;
import com.thinkbiganalytics.spark.dataprofiler.functions.IndividualColumnValueCounts;
import com.thinkbiganalytics.spark.dataprofiler.functions.PartitionLevelModels;
import com.thinkbiganalytics.spark.dataprofiler.functions.TotalColumnValueCounts;
import com.thinkbiganalytics.spark.dataprofiler.model.StatisticsModel;

import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.broadcast.Broadcast;
import org.apache.spark.sql.types.StructField;
import org.springframework.stereotype.Component;

import java.util.Map;

import scala.Tuple2;

/**
 * For Spark 2
 */
@Component
public class ProfilerStrategyV2 implements ProfilerStrategy {

    @Override
    public StatisticsModel profileStatistics(DataSet set, Broadcast<Map<Integer, StructField>> bSchemaMap) {
        JavaPairRDD<Tuple2<Integer, Object>, Integer> columnValueCounts;
        StatisticsModel profileStatisticsModel = null;

        /* Get ((column index, column value), count) */
        columnValueCounts = set
            .javaRDD()
            .flatMapToPair(new IndividualColumnValueCounts())
            .reduceByKey(new TotalColumnValueCounts());

        /* Generate the profile model */
        JavaRDD<StatisticsModel> partitionLevelModels = columnValueCounts.mapPartitions(new PartitionLevelModels(bSchemaMap));

        if (!partitionLevelModels.isEmpty()) {
            profileStatisticsModel = partitionLevelModels.reduce(new CombineModels());
        }

        return profileStatisticsModel;
    }
}
