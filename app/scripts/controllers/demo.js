'use strict';

angular.module('cloudifyWidgetHpClientApp')
    .controller('DemoCtrl', function ($scope,$location) {
        $scope.currentStep = 1;
        console.log($location.path());
    });
