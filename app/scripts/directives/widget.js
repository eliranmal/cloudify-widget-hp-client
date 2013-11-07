'use strict';

angular.module('cloudifyWidgetHpClientApp')
    .directive('widget', function () {
        return {
            templateUrl: '/views/widgetSkin.html',
            restrict: 'A',
            scope: {
                selectedWidget: '=',
                requireAdvanced:'@',
                widgetTime: '='
            },
            controller: function ($scope, $element, $location, $timeout, widgetService, SessionService, LeadService) {

                $scope.postUrl = 'http://' + window.conf.widgetServer;
                $scope.pageUrl = $location.protocol() + '://' + $location.host();
                $scope.play = false;
                $scope.advanced = {
                    project_name: '',
                    hpcs_key: '',
                    hpcs_secret_key: ''
                };
                $scope.manageUrl = null;
                $scope.consoleUrl = null;
                $scope.widgetLog = [];

                var timeout = 0;
                var milliseconds = 0;
                var leadTimeLeft = LeadService.getTimeLeft();
                var isNewWidgetSelected = false;
                var handlers = {
                    'widget_log': function (e) {
                        if (isNewWidgetSelected) {
                            return;
                        }

                        $scope.$apply(function () {
                            var msg = JSON.parse(e.data);

                            if (msg.message.charAt(0) === '.') {
                                $scope.widgetLog.pop();
                                $scope.widgetLog.push(msg.message);
                            } else {
                                $scope.widgetLog.splice($scope.widgetLog.length - 1, 0, msg.message);
                            }

                            if (msg.type === 'important') {
                                $scope.widgetLog.pop();
                            }

                            if (msg.type === 'error') {
                                var data = SessionService.getSessionData();


                                if (mixpanel.get_distinct_id() !== undefined) {
                                    mixpanel.identify(data.leadMail);
                                    mixpanel.people.identify(data.leadMail);
                                    mixpanel.track('HP Widget error', data);
                                }

                                widgetService.reportError(data);
                            }
                        });
                        _scrollLog();
                    },
                    'set_advanced': function (e) {
                        var msg = JSON.parse(e.data);
                        $scope.advanced.project_name = msg.project;
                        $scope.advanced.hpcs_key = msg.key;
                        $scope.advanced.hpcs_secret_key = msg.secretKey;
                    },
                    'widget_status': function (e) {
                        var msg = JSON.parse(e.data);
                        milliseconds = msg.status.timeleftMillis;
                        SessionService.setInstanceId(msg.status.instanceId);
                        SessionService.setWidgetId($scope.selectedWidget.id);


                        if (msg.status.publicIp !== null) {
                            $scope.manageUrl = 'http://' + msg.status.publicIp + ':8099/';
                        } else {
                            $scope.manageUrl = null;
                        }

                        if (msg.status.instanceIsAvailable === true) {
                            $scope.consoleUrl = msg.status.consoleLink.url;
                        } else {
                            $scope.consoleUrl = null;
                        }

                        if (isNewWidgetSelected) {
                            $scope.$apply(function () {
                                $scope.widgetLog = msg.status.output;
                                isNewWidgetSelected = false;
                                _sendProlong();
                            });
                        }

                        $scope.play = msg.status.state !== 'STOPPED';

                        _startTimer();
                    },
                    'stop_widget': function () {
                        $scope.widgetTime = '';
                        _stopTimer();
                    }
                };

                function isRequireAdvanced(){
                    return $scope.requireAdvanced === 'true';
                }

                $scope.playWidget = function () {
                    if (!$scope.credentialsChecked() || leadTimeLeft === 0) {
                        return;
                    }

                    $scope.play = true;
                    var iframe = $element.find('#iframe');
                    var postObj = {name: 'play_widget'};
                    if (_getAdvanced().project !== '' && _getAdvanced().key !== '' && _getAdvanced().secretKey !== '') {
                        postObj.advanced = _getAdvanced();
                    }
                    $scope.widgetLog = [];

                    $.postMessage(JSON.stringify(postObj), $scope.postUrl, iframe.get(0).contentWindow);
                };

                $scope.stopWidget = function () {
                    $scope.play = false;
                    SessionService.removeInstanceId();
                    var iframe = $element.find('#iframe');

                    $.postMessage(JSON.stringify({name: 'stop_widget'}), $scope.postUrl, iframe.get(0).contentWindow);
                };

                $scope.hideAdvanced = function () {
                    return !isRequireAdvanced();
                };

                function _isNotEmptyString(str) {
                    return str !== undefined && str !== null && $.trim(str).length > 0;
                }

                function hasAdvancedCredentials() {
                    return _isNotEmptyString($scope.advanced.project_name) &&
                        _isNotEmptyString($scope.advanced.hpcs_key) &&
                        _isNotEmptyString($scope.advanced.hpcs_secret_key);
                }

                $scope.credentialsChecked = function () {
                    return  !isRequireAdvanced() || hasAdvancedCredentials();


                };


                $scope.playEnabled = function () {
                    if ($scope.selectedWidget === null) {
                        return false;
                    }
                    else if (!$scope.requireAdvanced) {
                        return true;
                    } else if ($scope.credentialsChecked()) {
                        return true;
                    }
                    return false;
                };


                $scope.onTimeout = function () {
                    milliseconds -= 1000;
                    $scope.widgetTime = milliseconds;
                    timeout = $timeout($scope.onTimeout, 1000);
                };

                $scope.$watch('selectedWidget', function (newWidget) {
                    if (newWidget !== null && leadTimeLeft !== 0) {
                        $scope.play = false;
                        $scope.widgetTime = '';
                        $scope.manageUrl = null;
                        $scope.consoleUrl = null;
                        $scope.widgetLog = [];
                        isNewWidgetSelected = true;
                        _stopTimer();
                    }
                });

                function _getAdvanced() {
                    return {
                        project: $scope.advanced.project_name,
                        key: $scope.advanced.hpcs_key,
                        secretKey: $scope.advanced.hpcs_secret_key
                    };
                }

                function _startTimer() {
                    _stopTimer();
                    timeout = $timeout($scope.onTimeout, 1000);
                }

                function _stopTimer() {
                    $timeout.cancel(timeout);
                }

                function _sendProlong() {
                    var data = {
                        'leadId': LeadService.getLead().id,
                        'instanceId': SessionService.getInstanceId()
                    };

                    if (data.leadId !== undefined && data.instanceId !== undefined) {
                        widgetService.prolong(data);
                    }
                }

                function _scrollLog() {
                    var log = $element.find('#log')[0];
                    log.scrollTop = log.scrollHeight;
                }

                function _checkLeadTime() {
                    if (leadTimeLeft <= 0) {
                        $scope.playEnabled = false;
                        $scope.play = false;
                        $scope.widgetLog.push('Your free trial is over. <a href="#/signup">Click here</a> to get Cloudify');
                    }
                }

                $.receiveMessage(function (e) {
                    var msg = JSON.parse(e.data);

                    if (handlers.hasOwnProperty(msg.name)) {
                        try {
                            handlers[msg.name](e);
                        } catch (exception) {
                            console.log(['problem invoking callback for ', e, exception]);
                        }
                    }
                });

                _checkLeadTime();
            }
        };
    });
