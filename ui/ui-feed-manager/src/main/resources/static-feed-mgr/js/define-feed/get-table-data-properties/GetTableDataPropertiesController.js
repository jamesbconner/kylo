
(function () {

    var directive = function () {
        return {
            restrict: "EA",
            bindToController: {
                mode:'@'
            },
            controllerAs: 'ctl',
            scope: {},
            templateUrl: 'js/define-feed/get-table-data-properties/get-table-data-properties.html',
            controller: "GetTableDataPropertiesController",
            link: function ($scope, element, attrs, controller) {

            }

        };
    }

    var controller =  function($scope, $q,$http,$mdToast,RestUrlService, FeedService,EditFeedNifiPropertiesService,DBCPTableSchemaService) {


         var self = this;
        this.selectedTable = null;
        this.tableSchema = null;
        if(this.mode == 'create') {
            this.processor = FeedService.createFeedModel.inputProcessor;
            this.model = FeedService.createFeedModel;
        }
        else {
            this.processor = EditFeedNifiPropertiesService.editFeedModel.inputProcessor;
            this.model = EditFeedNifiPropertiesService.editFeedModel;

        }

        this.allTables = {};

        this.SOURCE_TABLE_PROPERTY_KEY = 'Source Table';
        this.SOURCE_FIELDS_PROPERTY_KEY = 'Source Fields';
        this.DB_CONNECTION_SERVICE_PROPERTY_KEY = 'Source Database Connection'; //''
        this.LOAD_STRATEGY_PROPERTY_KEY = 'Load Strategy';
        this.INCREMENTAL_DATE_PROPERTY_KEY = 'Date Field';

        this.RETENTION_PERIOD_PROPERTY_KEY = 'Backoff Period';
        this.ARCHIVE_UNIT_PROPERTY_KEY = 'Minimum Time Unit';





        this.dbConnectionProperty = findProperty(self.DB_CONNECTION_SERVICE_PROPERTY_KEY)







        this.tableFields = [];
        this.originalTableFields = [];

        this.tableFieldsDirty = false;
        var customPropertyKeys = [self.DB_CONNECTION_SERVICE_PROPERTY_KEY,self.SOURCE_TABLE_PROPERTY_KEY, self.SOURCE_FIELDS_PROPERTY_KEY, self.LOAD_STRATEGY_PROPERTY_KEY, self.INCREMENTAL_DATE_PROPERTY_KEY, self.RETENTION_PERIOD_PROPERTY_KEY,self.ARCHIVE_UNIT_PROPERTY_KEY];
        initPropertyLookup();
        function initPropertyLookup() {
            self.tableProperty = findProperty(self.SOURCE_TABLE_PROPERTY_KEY);
            self.fieldsProperty = findProperty(self.SOURCE_FIELDS_PROPERTY_KEY);
            self.loadStrategyProperty = findProperty(self.LOAD_STRATEGY_PROPERTY_KEY);
            if(self.loadStrategyProperty && (self.loadStrategyProperty.value == null || self.loadStrategyProperty.value == undefined)){
                self.loadStrategyProperty.value = 'INCREMENTAL'; //default to 'INCREMENTAL'
            }


            self.retentionPeriodProperty = findProperty(self.RETENTION_PERIOD_PROPERTY_KEY);
            self.archiveUnitProperty = findProperty(self.ARCHIVE_UNIT_PROPERTY_KEY);

            self.deleteSourceProperty = {value:'false',key:'Delete Source'};
            self.incrementalDateFieldProperty =  findProperty(self.INCREMENTAL_DATE_PROPERTY_KEY);
        }

        if(self.model.table.method == 'EXISTING_TABLE'){
            self.selectedTable = self.model.table.existingTableName;
        }

        this.isCustomProperty = function(property){
            return _.contains(customPropertyKeys,property.key);
        }

        this.customPropertiesFilter =function(property) {
            return self.isCustomProperty(property)
        }

        this.notCustomPropertiesFilter =function(property) {
            return !self.isCustomProperty(property)
        }

        this.tableFieldsDragEnd = function(event){
            self.tableFieldsDirty = true;
        }
        this.removeTableField = function($index){
            self.tableFields.splice($index, 1);
            self.tableFieldsDirty = true;
        }

        this.resetTableFields = function(){
            self.tableFields = angular.copy(self.originalTableFields);
        }

        function findProperty(key){
            //get all the props for this input

            var matchingProperty = _.find(self.processor.properties,function(property){
                return property.key == key;
            });
            //on edit mode the model only has the props saved for that type.
            //need to find the prop associated against the other input type
            if((matchingProperty == undefined || matchingProperty == null)&& self.model.allInputProcessorProperties != undefined){
                var props = self.model.allInputProcessorProperties[self.processor.processorId];
                if(props){
                    matchingProperty = _.find(props,function(property){
                        return property.key == key;
                    });
                }
            }
            return matchingProperty;
        }

        /** TABLE AUTO COMPLETE **/

        function createFilterForTable(query) {
            var lowercaseQuery = angular.lowercase(query);
            return function filterFn(item) {
                return (item.fullNameLower.indexOf(lowercaseQuery) != -1 );
            };
        }

        /**
         * return the list of tables for the selected Service ID
         * @param query
         * @returns {*}
         */
       function queryTablesSearch (query) {
            var dbcpProperty = self.dbConnectionProperty;
           if(dbcpProperty != null && dbcpProperty.value != null) {
               var serviceId = dbcpProperty.value;

               if (self.allTables[serviceId] == undefined) {
                   var deferred = $q.defer();
                   var tables = $http.get(DBCPTableSchemaService.LIST_TABLES_URL(serviceId)).then(function (response) {
                      self.allTables[serviceId] = parseTableResponse(response.data);
                       var results = query ?  self.allTables[serviceId].filter(createFilterForTable(query)) : self.allTables;
                       deferred.resolve(results);
                   });
                   return deferred.promise;
               }
               else {
                   var results = query ? self.allTables[serviceId].filter(createFilterForTable(query)) : [];

                   return results;
               }
           }
           else {
               return [];
           }
        }

        /**
         * Turn the schema.table string into an object for template display
         * @param response
         * @returns {Array}
         */
        function parseTableResponse(response){
            var allTables =  [];
            if(response) {
                angular.forEach(response,function(table){
                    var schema = table.substr(0,table.indexOf("."));
                    var tableName= table.substr(table.indexOf(".")+1);
                    allTables.push({schema:schema,tableName:tableName, fullName:table,fullNameLower:table.toLowerCase()});
                })
            }
            return allTables;
        }



        this.tablesAutocomplete = {
            clear:function(){
                this.searchText = '';
                this.selectedTable = null;
            },
            searchText:'',
            selectedTable:null,
            searchTextChange:function(text){

            },
            selectedItemChange : function(table){
            self.selectedTable = table;
            },
            querySearch:function(txt){
                return queryTablesSearch(txt);
            }
        }

        if(this.mode == 'edit'){
            var processorTableName = this.model.table.existingTableName;
            this.tablesAutocomplete.selectedTable = this.model.table.existingTableName;
            if(processorTableName != null) {
                var schemaName = processorTableName.substring(0, processorTableName.indexOf("."));
                var tableName = processorTableName.substring(processorTableName.indexOf("."));
                var fullNameLower = processorTableName.toLowerCase();
                this.selectedTable = this.tablesAutocomplete.selectedTable = {
                    schema: schemaName,
                    tableName: tableName,
                    fullName: processorTableName,
                    fullNameLower: fullNameLower
                };
            }
        }

        /** END TABLE AUTO COMPLETE **/

        function describeTable(){
            //get the property that stores the DBCPController Service
            var dbcpProperty = self.dbConnectionProperty;
            if(dbcpProperty != null && dbcpProperty.value != null && self.selectedTable != null) {
                var successFn = function (response) {
                    self.tableSchema = response.data;
                    self.tableFields = self.tableSchema.fields;
                    self.originalTableFields = angular.copy(self.tableSchema.fields);
                    self.tableFieldsDirty = false;

                    self.model.table.sourceTableSchema.fields=self.originalTableFields;

                    FeedService.setTableFields(self.tableSchema.fields);
                    self.model.table.method = 'EXISTING_TABLE';

                    if(self.tableSchema.schemaName != null){
                        self.model.table.existingTableName = self.tableSchema.schemaName+"."+self.tableSchema.name;
                    }
                    else {
                        self.model.table.existingTableName = self.tableSchema.name;
                    }
                    self.model.table.sourceTableSchema.name=self.model.table.existingTableName;
                }

                var serviceId = dbcpProperty.value;
                var promise = $http.get(DBCPTableSchemaService.DESCRIBE_TABLE_URL(serviceId,self.selectedTable.tableName),{params:{schema:self.selectedTable.schema}})
                promise.then(successFn,function(err){});
                return promise;

            }
        }

        this.filterFieldDates = function(field){
            return field.dataType == 'date' || field.dataType == 'timestamp';
        }


        this.onIncrementalDateFieldChange = function(){
            var prop = self.incrementalDateFieldProperty;
            if(prop != null) {
                prop.value =  self.model.table.incrementalDateField;
            }
        }



        //getTableNames();

if(this.mode =='create') {
    $scope.$watch(function () {
        return FeedService.createFeedModel.inputProcessor;
    }, function (newVal) {

        if (newVal != null && newVal != undefined) {
            self.processor = newVal;
            initPropertyLookup();
        }
    });
}
        else {

    $scope.$watch(function () {
        return EditFeedNifiPropertiesService.editFeedModel.inputProcessor;
    }, function (newVal) {

        if (newVal != null && newVal != undefined) {
            self.processor = newVal;
            initPropertyLookup();
        }
    });
}

        /**
         * Watch for changes on the table to refresh the schema
         */
        $scope.$watch(function(){
            return self.selectedTable
        },function(newVal){
            var tableProperty = self.tableProperty
            if(tableProperty && newVal != undefined) {
                tableProperty.value = newVal.fullName;
                if (newVal != null && newVal != undefined) {
                    if(self.mode == 'create') {
                        //only describe on the Create as the Edit will be disabled and we dont want to change the field data
                        describeTable();
                    }
                }
                else {
                    self.tableSchema = null;
                }
            }
        })

        /**
         * Watch for changes on the Connection and refresh the tables
         */
        if(self.dbConnectionProperty) {
            $scope.$watch(function () {
                return self.dbConnectionProperty.value
            }, function (newVal) {
                //getTableNames();
            });
        }

        this.loadStrategies = [{name:'Full Load',type:'SNAPSHOT',strategy:'FULL_LOAD',hint:'Snapshot and overwrite table'},{name:'Incremental',type:'DELTA',strategy:'INCREMENTAL',hint:'Merges content into existing table'}];

        if(self.loadStrategyProperty){
            $scope.$watch(function () {
                return self.loadStrategyProperty.value
            }, function (newVal) {
              if(newVal == 'FULL_LOAD'){
                  self.model.table.tableType = 'SNAPSHOT';
              }
                else if(newVal == 'INCREMENTAL'){
                  self.model.table.tableType = 'DELTA';
              }

            });
        }
    };


    angular.module(MODULE_FEED_MGR).controller('GetTableDataPropertiesController', controller);

    angular.module(MODULE_FEED_MGR)
        .directive('thinkbigGetTableDataProperties', directive);

   // angular.module(MODULE_FEED_MGR)
    //    .directive('thinkbigGetTableDataProperties', directive);

})();

