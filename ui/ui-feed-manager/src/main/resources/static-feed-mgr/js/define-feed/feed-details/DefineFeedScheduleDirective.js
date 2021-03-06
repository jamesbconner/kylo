/*-
 * #%L
 * thinkbig-ui-feed-manager
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
(function() {

    var directive = function() {
        return {
            restrict: "EA",
            bindToController: {
                stepIndex: '@'
            },
            controllerAs: 'vm',
            require: ['thinkbigDefineFeedSchedule', '^thinkbigStepper'],
            scope: {},
            templateUrl: 'js/define-feed/feed-details/define-feed-schedule.html',
            controller: "DefineFeedScheduleController",
            link: function($scope, element, attrs, controllers) {
                var thisController = controllers[0];
                var stepperController = controllers[1];
                thisController.stepperController = stepperController;
                thisController.totalSteps = stepperController.totalSteps;
            }

        };
    };

    function DefineFeedScheduleController($scope, $http, $mdDialog, $timeout, RestUrlService, FeedService, StateService, StepperService, CategoriesService, BroadcastService,
                                          FeedCreationErrorService) {
        var self = this;

        /**
         * Get notified when a step is changed/becomes active
         */
        BroadcastService.subscribe($scope, StepperService.ACTIVE_STEP_EVENT, onActiveStep);

        /**
         * get notified when any step changes its state (becomes enabled/disabled)
         * This is needed to block out the save button if a step is invalid/disabled
         */
        BroadcastService.subscribe($scope, StepperService.STEP_STATE_CHANGED_EVENT, onStepStateChange);

        /**
         * reference to the parent stepper controller
         * @type {null}
         */
        this.stepperController = null;

        /**
         * The stepperController will be accessible shortly after this controller is created.
         * This indicates the amount of time it should wait in an attempt to wire itself with the controller
         * @type {number}
         */
        this.waitForStepperControllerRetryAmount = 0;

        /**
         * Reference to this step number
         * @type {number}
         */
        this.stepNumber = parseInt(this.stepIndex) + 1;

        /**
         * The model
         */
        this.model = FeedService.createFeedModel;

        /**
         * The Timer amount with default
         * @type {number}
         */
        this.timerAmount = 5;
        /**
         * the timer units with default
         * @type {string}
         */
        this.timerUnits = "min";

        /**
         * flag indicates the data is valid
         * @type {boolean}
         */
        this.isValid = false;

        /**
         * The object that is populated after the Feed is created and returned from the server
         * @type {null}
         */
        this.createdFeed = null;

        /**
         * Indicates if any errors exist from the server  upon saving
         * @type {Array}
         */
        this.feedErrorsData = [];
        /**
         * reference to error count so the UI can show it
         * @type {number}
         */
        this.feedErrorsCount = 0;

        /**
         * Indicates that NiFi is clustered.
         *
         * @type {boolean}
         */
        this.isClustered = true;

        this.savingFeed = false;

        /**
         * All possible schedule strategies
         * @type {*[]}
         */
        var allScheduleStrategies = [{label: "Cron", value: "CRON_DRIVEN"}, {label: "Timer", value: "TIMER_DRIVEN"}, {label: "Trigger/Event", value: "TRIGGER_DRIVEN"},
            {label: "On primary node", value: "PRIMARY_NODE_ONLY"}];

        /**
         * Different templates have different schedule strategies.
         * Filter out those that are not needed based upon the template
         */
        function updateScheduleStrategies() {
            // Filter schedule strategies
            var allowPreconditions = (self.model.allowPreconditions && self.model.inputProcessorType.indexOf("TriggerFeed") >= 0);

            self.scheduleStrategies = _.filter(allScheduleStrategies, function(strategy) {
                if (allowPreconditions) {
                    return (strategy.value === "TRIGGER_DRIVEN");
                } else if (strategy.value === "PRIMARY_NODE_ONLY") {
                    return self.isClustered;
                } else {
                    return (strategy.value !== "TRIGGER_DRIVEN");
                }
            });

            // Check if last strategy is valid
            if (self.model.schedule.schedulingStrategy) {
                var validStrategy = _.some(self.scheduleStrategies, function(strategy) {
                    return strategy.value == self.model.schedule.schedulingStrategy;
                });
                if (!validStrategy) {
                    self.model.schedule.schedulingStrategyTouched = false;
                }
            }
        }

        /**
         * Force the model and timer to be set to Timer with the defaults
         */
        function setTimerDriven() {
            self.model.schedule.schedulingStrategy = 'TIMER_DRIVEN';
            self.timerAmount = 5;
            self.timerUnits = "min";
            self.model.schedule.schedulingPeriod = "5 min";
        }

        /**
         * Force the model to be set to Cron
         */
        function setCronDriven() {
            self.model.schedule.schedulingStrategy = 'CRON_DRIVEN';
            self.model.schedule.schedulingPeriod = FeedService.DEFAULT_CRON;
        }

        /**
         * Force the model to be set to Triggger
         */
        function setTriggerDriven() {
            self.model.schedule.schedulingStrategy = 'TRIGGER_DRIVEN'
        }

        /**
         * Set the scheduling strategy to 'On primary node'.
         */
        function setPrimaryNodeOnly() {
            self.model.schedule.schedulingStrategy = "PRIMARY_NODE_ONLY";
            self.timerAmount = 5;
            self.timerUnits = "min";
            self.model.schedule.schedulingPeriod = "5 min";
        }

        function setDefaultScheduleStrategy() {
            if (self.model.inputProcessorType != '' && (self.model.schedule.schedulingStrategyTouched == false || self.model.schedule.schedulingStrategyTouched == undefined)) {
                if (self.model.inputProcessorType.indexOf("GetFile") >= 0) {
                    setTimerDriven();
                }
                else if (self.model.inputProcessorType.indexOf("GetTableData") >= 0) {
                    setCronDriven();
                }
                else if (self.model.inputProcessorType.indexOf("TriggerFeed") >= 0) {
                    setTriggerDriven();
                }
                self.model.schedule.schedulingStrategyTouched = true;
            }
        }

        /**
         * update the default strategies in the list
         */
        updateScheduleStrategies();

        /**
         * Called when any step is active.
         *
         * @param event
         * @param index
         */
        function onActiveStep(event, index) {
            if (index == parseInt(self.stepIndex)) {

                updateScheduleStrategies();
                //make sure the selected strategy is valid

                setDefaultScheduleStrategy();
            }
        }

        /**
         * get notified of the step state (enabled/disabled) changed
         * Validate the form
         * @param event
         * @param index
         */
        function onStepStateChange(event, index) {
            validate();
        }

        /**
         * When the timer changes show warning if its < 3 seconds indicating to the user this is a "Rapid Fire" feed
         */
        this.timerChanged = function() {
            if (self.timerAmount < 0) {
                self.timerAmount = null;
            }
            if (self.timerAmount != null && (self.timerAmount == 0 || (self.timerAmount < 3 && self.timerUnits == 'sec'))) {
                self.showTimerAlert();
            }
            self.model.schedule.schedulingPeriod = self.timerAmount + " " + self.timerUnits;
            validate();
        };

        self.showTimerAlert = function(ev) {
            $mdDialog.show(
                    $mdDialog.alert()
                            .parent(angular.element(document.body))
                            .clickOutsideToClose(false)
                            .title('Warning. Rapid Timer')
                            .textContent('Warning.  You have this feed scheduled for a very fast timer.  Please ensure you want this feed scheduled this fast before you proceed.')
                            .ariaLabel('Warning Fast Timer')
                            .ok('Got it!')
                            .targetEvent(ev)
            );
        };

        /**
         * When the strategy changes ensure the defaults are set
         */
        this.onScheduleStrategyChange = function() {
            self.model.schedule.schedulingStrategyTouched = true;
            if (self.model.schedule.schedulingStrategy == "CRON_DRIVEN") {
                if (self.model.schedule.schedulingPeriod != FeedService.DEFAULT_CRON) {
                    setCronDriven();
                }
            } else if (self.model.schedule.schedulingStrategy == "TIMER_DRIVEN") {
                setTimerDriven();
            } else if (self.model.schedule.schedulingStrategy === "PRIMARY_NODE_ONLY") {
                setPrimaryNodeOnly();
            }
            validate();
        };

        /**
         * Show activity
         */
        function showProgress() {
            if (self.stepperController) {
                self.stepperController.showProgress = true;
            }
        }

        /**
         * hide progress activity
         */
        function hideProgress() {
            if (self.stepperController) {
                self.stepperController.showProgress = false;
            }
        }

        /**
         * validate the inputs and model data
         */
        function validate() {
            //cron expression validation is handled via the cron-expression validator
            var valid = (self.model.schedule.schedulingStrategy == "CRON_DRIVEN") ||
                        (self.model.schedule.schedulingStrategy == "TIMER_DRIVEN" && self.timerAmount != undefined && self.timerAmount != null) ||
                        (self.model.schedule.schedulingStrategy == "TRIGGER_DRIVEN" && self.model.schedule.preconditions != null && self.model.schedule.preconditions.length > 0) ||
                        (self.model.schedule.schedulingStrategy == "PRIMARY_NODE_ONLY" && self.timerAmount != undefined && self.timerAmount != null);
            if (valid) {
                waitForStepperController(function() {
                    self.isValid = !self.stepperController.arePreviousStepsDisabled(self.stepIndex)
                });

            }
            else {
                self.isValid = valid;
            }
        }

        /**
         * attempt to wire the stepper controller references
         * @param callback
         */
        function waitForStepperController(callback) {
            if (self.stepperController) {
                self.waitForStepperControllerRetryAmount = 0;
                callback();
            }
            else {
                if (self.waitForStepperControllerRetryAmount < 20) {
                    self.waitForStepperControllerRetryAmount++;
                    $timeout(function() {
                        waitForStepperController(callback)
                    }, 10);
                }
            }
        }

        this.deletePrecondition = function($index) {
            if (self.model.schedule.preconditions != null) {
                self.model.schedule.preconditions.splice($index, 1);
            }
        };

        this.showPreconditionDialog = function(index) {
            if (index == undefined) {
                index = null;
            }
            $mdDialog.show({
                controller: 'FeedPreconditionsDialogController',
                templateUrl: 'js/define-feed/feed-details/feed-preconditions/define-feed-preconditions-dialog.html',
                parent: angular.element(document.body),
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    feed: self.model,
                    index: index
                }
            }).then(function() {
                validate();
            });
        };

        /**
         * Validate the form
         */
        validate();

        /**
         * Create the feed, save it to the server, populate the {@code createdFeed} object upon save
         */
        this.createFeed = function() {
            self.savingFeed = true;
            showProgress();

            self.createdFeed = null;

            FeedService.saveFeedModel(self.model).then(function(response) {

                self.createdFeed = response.data;
                CategoriesService.reload();
                self.savingFeed = false;
                StateService.navigateToDefineFeedComplete(self.createdFeed, null);

                //  self.showCompleteDialog();
            }, function(response) {
                self.savingFeed = false;
                self.createdFeed = response.data;
                FeedCreationErrorService.buildErrorData(self.model.feedName, self.createdFeed);
                hideProgress();
                FeedCreationErrorService.showErrorDialog();
            });
        };

        // Detect if NiFi is clustered
        $http.get(RestUrlService.NIFI_CLUSTER_SUMMARY_URL).then(function(response) {
            self.isClustered = (angular.isDefined(response.data.clustered) && response.data.clustered);
            updateScheduleStrategies();
        });
    }

    angular.module(MODULE_FEED_MGR).controller("DefineFeedScheduleController", DefineFeedScheduleController);
    angular.module(MODULE_FEED_MGR).directive("thinkbigDefineFeedSchedule", directive);

    angular.module(MODULE_FEED_MGR).directive('cronExpressionValidator', ['RestUrlService', '$q', '$http', function(RestUrlService, $q, $http) {
        return {
            restrict: 'A',
            require: 'ngModel',
            link: function(scope, elm, attrs, ctrl) {
                ctrl.$asyncValidators.cronExpression = function(modelValue, viewValue) {
                    var deferred = $q.defer();
                    $http.get(RestUrlService.VALIDATE_CRON_EXPRESSION_URL, {params: {cronExpression: viewValue}}).then(function(response) {

                        if (response.data.valid == false) {
                            deferred.reject("Invalid Cron Expression");
                        } else {
                            deferred.resolve()
                        }
                    });
                    return deferred.promise;

                }
            }
        }
    }]);

})();

(function() {

    var controller = function($scope, $mdDialog, $mdToast, $http, StateService, FeedService, PolicyInputFormService, feed, index) {
        $scope.feed = feed;
        $scope.options = [];

        $scope.ruleMode = 'NEW';

        FeedService.getPossibleFeedPreconditions().then(function(response) {
            var currentFeedValue = null;
            if ($scope.feed != null) {
                currentFeedValue = PolicyInputFormService.currentFeedValue($scope.feed);
                currentFeedValue = currentFeedValue.toLowerCase();
            }

            $scope.options = PolicyInputFormService.groupPolicyOptions(response.data, currentFeedValue);
            ruleTypesAvailable();
        });

        var arr = feed.schedule.preconditions;

        if (arr != null && arr != undefined) {

            $scope.preconditions = angular.copy(arr);
        }

        function findRuleType(ruleName) {
            return _.find($scope.options, function(opt) {
                return opt.name == ruleName;
            });
        }

        function ruleTypesAvailable() {
            if ($scope.editRule != null) {
                $scope.ruleType = findRuleType($scope.editRule.name);
            }
        }

        $scope.pendingEdits = false;
        $scope.editRule = null;
        $scope.ruleType = null;
        $scope.editIndex = null;
        $scope.editMode = 'NEW';
        if (index != null) {
            $scope.editMode = 'EDIT';
            $scope.editIndex = index;
            var editRule = $scope.preconditions[index];
            editRule.groups = PolicyInputFormService.groupProperties(editRule);
            PolicyInputFormService.updatePropertyIndex(editRule);
            //make all rules editable
            editRule.editable = true;
            $scope.editRule = editRule;
        }
        var modeText = "Add";
        if ($scope.editMode == 'EDIT') {
            modeText = "Edit";
        }

        $scope.title = modeText + " Precondition";

        $scope.addText = 'ADD PRECONDITION';
        $scope.cancelText = 'CANCEL ADD';

        function _cancelEdit() {
            $scope.editMode = 'NEW';
            $scope.addText = 'ADD PRECONDITION';
            $scope.cancelText = 'CANCEL ADD';
            $scope.ruleType = null;
            $scope.editRule = null;
        }

        $scope.cancelEdit = function() {
            _cancelEdit();
        };

        $scope.onRuleTypeChange = function() {
            if ($scope.ruleType != null) {
                var rule = angular.copy($scope.ruleType);
                rule.groups = PolicyInputFormService.groupProperties(rule);
                PolicyInputFormService.updatePropertyIndex(rule);
                //make all rules editable
                rule.editable = true;
                $scope.editRule = rule;
            }
            else {
                $scope.editRule = null;
            }
        };

        function validateForm() {
            return PolicyInputFormService.validateForm($scope.preconditionForm, $scope.editRule.properties, false);
        }

        function buildDisplayString() {
            if ($scope.editRule != null) {
                var str = '';
                _.each($scope.editRule.properties, function(prop) {
                    if (prop.type != 'currentFeed') {
                        //chain it to the display string
                        if (str != '') {
                            str += ';';
                        }
                        str += ' ' + prop.displayName;
                        var val = prop.value;
                        if ((val == null || val == undefined || val == '') && (prop.values != null && prop.values.length > 0)) {
                            val = _.map(prop.values, function(labelValue) {
                                return labelValue.value;
                            }).join(",");
                        }
                        str += ": " + val;
                    }
                });
                $scope.editRule.propertyValuesDisplayString = str;
            }
        }

        $scope.deletePrecondition = function() {
            var index = $scope.editIndex;
            if ($scope.preconditions != null && index != null) {
                $scope.preconditions.splice(index, 1);
            }
            feed.schedule.preconditions = $scope.preconditions;
            $scope.pendingEdits = true;
            $mdDialog.hide('done');
        };

        $scope.addPolicy = function() {

            var validForm = validateForm();
            if (validForm == true) {
                if ($scope.preconditions == null) {
                    $scope.preconditions = [];
                }
                buildDisplayString();

                $scope.editRule.ruleType = $scope.ruleType;
                if ($scope.editMode == 'NEW') {
                    $scope.preconditions.push($scope.editRule);
                }
                else if ($scope.editMode == 'EDIT') {
                    $scope.preconditions[$scope.editIndex] = $scope.editRule;

                }

                $scope.pendingEdits = true;
                feed.schedule.preconditions = $scope.preconditions;
                $mdDialog.hide('done');
            }
        };

        $scope.hide = function() {
            _cancelEdit();
            $mdDialog.hide();
        };

        $scope.cancel = function() {
            _cancelEdit();
            $mdDialog.hide();
        };
    };

    angular.module(MODULE_FEED_MGR).controller("FeedPreconditionsDialogController", controller);

}());

