package com.thinkbiganalytics.scheduler.rest.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;

/**
 * Created by sr186054 on 9/24/15.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class TriggerInfo {

  public static enum TriggerState {
    NONE,
    NORMAL,
    PAUSED,
    COMPLETE,
    ERROR,
    BLOCKED;
  }

  private ScheduleIdentifier triggerIdentifier;
  private ScheduleIdentifier jobIdentifier;
  private Date nextFireTime;
  private Date previousFireTime;
  private Date startTime;
  private Date endTime;
  private String cronExpression;
  private String description;
  public TriggerState state;
  private Class triggerClass;
  private String cronExpressionSummary;

  public TriggerInfo() {

  }

  public TriggerInfo(@JsonProperty("jobIdentifier") ScheduleIdentifier jobIdentifier,
                     @JsonProperty("triggerIdentifier") ScheduleIdentifier triggerIdentifier) {
    this.jobIdentifier = jobIdentifier;
    this.triggerIdentifier = triggerIdentifier;
  }


  public ScheduleIdentifier getTriggerIdentifier() {
    return triggerIdentifier;
  }

  public ScheduleIdentifier getJobIdentifier() {
    return jobIdentifier;
  }


  public Date getNextFireTime() {
    return nextFireTime;
  }


  public Date getPreviousFireTime() {
    return previousFireTime;
  }


  public Date getStartTime() {
    return startTime;
  }


  public Date getEndTime() {
    return endTime;
  }


  public String getCronExpression() {
    return cronExpression;
  }


  public String getDescription() {
    return description;
  }


  public TriggerState getState() {
    return state;
  }


  public void setTriggerIdentifier(ScheduleIdentifier triggerIdentifier) {
    this.triggerIdentifier = triggerIdentifier;
  }


  public void setJobIdentifier(ScheduleIdentifier jobIdentifier) {
    this.jobIdentifier = jobIdentifier;
  }


  public void setNextFireTime(Date nextFireTime) {
    this.nextFireTime = nextFireTime;
  }


  public void setPreviousFireTime(Date previousFireTime) {
    this.previousFireTime = previousFireTime;
  }


  public void setStartTime(Date startTime) {
    this.startTime = startTime;
  }


  public void setEndTime(Date endTime) {
    this.endTime = endTime;
  }


  public void setCronExpression(String cronExpression) {
    this.cronExpression = cronExpression;
  }


  public void setDescription(String description) {
    this.description = description;
  }


  public void setState(TriggerState state) {
    this.state = state;
  }


  public Class getTriggerClass() {
    return triggerClass;
  }


  public void setTriggerClass(Class triggerClass) {
    this.triggerClass = triggerClass;
  }


  public String getCronExpressionSummary() {
    return cronExpressionSummary;
  }


  public void setCronExpressionSummary(String cronExpressionSummary) {
    this.cronExpressionSummary = cronExpressionSummary;
  }
}