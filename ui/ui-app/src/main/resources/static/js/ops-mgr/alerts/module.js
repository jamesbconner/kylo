define(['angular','ops-mgr/alerts/module-name', 'kylo-utils/LazyLoadUtil','kylo-common', 'kylo-services','kylo-opsmgr'], function (angular,moduleName,lazyLoadUtil) {
   var module = angular.module(moduleName, []);

    module.config(['$stateProvider','$compileProvider',function ($stateProvider,$compileProvider) {
        //preassign modules until directives are rewritten to use the $onInit method.
        //https://docs.angularjs.org/guide/migration#migrating-from-1-5-to-1-6
        $compileProvider.preAssignBindingsEnabled(true);

        $stateProvider.state('alerts',{
            url:'/alerts',
            views: {
                'content': {
                    templateUrl: 'js/ops-mgr/alerts/alerts-table.html',
                }
            },
            resolve: {
                loadPage: lazyLoad()
            },
            data:{
                breadcrumbRoot:true,
                displayName:'Alerts',
                module:moduleName
            }
        }).state("alert-details",{
            url:"/alert-details/:alertId",
            params: {
                alertId: null
            },
            resolve: {
                loadPage: lazyLoad()
            },
            data:{
                displayName:'Alert Details',
                module:moduleName
            }
        })

        function lazyLoadController(path){
            return lazyLoadUtil.lazyLoadController(path,['ops-mgr/alerts/module-require']);
        }

        function lazyLoad(){
            return lazyLoadUtil.lazyLoad(['ops-mgr/alerts/module-require']);
        }

    }]);
    return module;


});




