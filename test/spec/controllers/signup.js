'use strict';

describe('Controller: SignupCtrl', function () {

  // load the controller's module
  beforeEach(module('cloudifyWidgetHpClientApp'));

  var SignupCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    SignupCtrl = $controller('SignupCtrl', {
      $scope: scope
    });
  }));
});
