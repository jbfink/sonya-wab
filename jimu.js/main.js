///////////////////////////////////////////////////////////////////////////
// Copyright © Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
    './ConfigManager',
    './LayoutManager',
    './DataManager',
    './WidgetManager',
    './FeatureActionManager',
    './SelectionManager',
    './DataSourceManager',
    './FilterManager',
    'dojo/_base/html',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/keys',
    'dojo/mouse',
    'dojo/topic',
    'dojo/cookie',
    'dojo/Deferred',
    'dojo/promise/all',
    'dojo/io-query',
    'esri/config',
    'esri/request',
    'esri/urlUtils',
    'esri/IdentityManager',
    'jimu/portalUrlUtils',
    './utils',
    './portalUtils',
    'require',
    'dojo/i18n',
    'dojo/i18n!./nls/main',
    'esri/main',
    'dojo/ready'
  ],
  function(ConfigManager, LayoutManager, DataManager, WidgetManager, FeatureActionManager, SelectionManager,
    DataSourceManager, FilterManager, html, lang, array, on, keys, mouse,
    topic, cookie, Deferred, all, ioquery, esriConfig, esriRequest, urlUitls, IdentityManager,
    portalUrlUtils, jimuUtils, portalUtils, require, i18n, mainBundle, esriMain, dojoReady) {
    /* global jimuConfig:true */
    var mo = {}, appConfig;

    window.topic = topic;

    //set the default timeout to 3 minutes
    esriConfig.defaults.io.timeout = 60000 * 3;

    //patch for JS API 3.10
    var hasMethod = typeof cookie.getAll === 'function';
    if (!hasMethod) {
      cookie.getAll = function(e) {
        var result = [];
        var v = cookie(e);
        if (v) {
          result.push(v);
        }
        return result;
      };
    }

    //jimu nls
    window.jimuNls = mainBundle;
    window.apiNls = esriMain.bundle;

    IdentityManager.setProtocolErrorHandler(function() {
      return true;
    });

    IdentityManager.setOAuthRedirectionHandler(function(info) {
      window.location = info.authorizeUrl +
                        '?canHandleCrossOrgSignin=true&' +
                        ioquery.objectToQuery(info.authorizeParams);
    });

    var ancestorWindow = jimuUtils.getAncestorWindow();
    var parentHttps = false, patt = /^http(s?):\/\//gi;

    try {
      parentHttps = ancestorWindow.location.href.indexOf("https://") === 0;
    } catch (err) {
      //if it's in different domain, we do not force https

      // console.log(err);
      // parentHttps = window.location.protocol === "https:";
    }

    esriRequest.setRequestPreCallback(function(ioArgs) {
      if (ioArgs.content && ioArgs.content.printFlag) { // printTask
        ioArgs.timeout = 300000;
      }

      //use https protocol
      if (parentHttps) {
        ioArgs.url = ioArgs.url.replace(patt, '//');
      }

      //working around an arcgis server feature service bug.
      //Requests to queryRelatedRecords operation fail with feature service 10.
      //Detect if request conatins the queryRelatedRecords operation
      //and then change the source url for that request to the corresponding mapservice.
      if (ioArgs.url.indexOf("/queryRelatedRecords?") !== -1) {
        var serviceUrl = ioArgs.url;
        var proxyUrl = esriConfig.defaults.io.proxyUrl;
        if(proxyUrl && ioArgs.url.indexOf(proxyUrl + "?") === 0){
          //This request uses proxy.
          //We should remove proxyUrl to get the real service url to detect if it is a hosted service or not.
          serviceUrl = ioArgs.url.replace(proxyUrl + "?", "");
        }
        if (!jimuUtils.isHostedService(serviceUrl)) { // hosted service doesn't depend on MapServer
          ioArgs.url = ioArgs.url.replace("FeatureServer", "MapServer");
        }
      }

      //For getJobStatus of gp service running in safari.
      //The url of requests sent to getJobStatus is the same. In safari, the requests will be blocked except
      //the first one. Here a preventCache tag is added for this kind of request.
      var reg = /GPServer\/.+\/jobs/;
      if (reg.test(ioArgs.url)) {
        ioArgs.preventCache = new Date().getTime();
      }

      // Use proxies to replace the premium content
      if(!window.isBuilder && appConfig && !appConfig.mode) {
        if (appConfig.appProxies && appConfig.appProxies.length > 0) {
          array.some(appConfig.appProxies, function(proxyItem) {
            var sourceUrl = proxyItem.sourceUrl, proxyUrl = proxyItem.proxyUrl;
            if (parentHttps) {
              sourceUrl = sourceUrl.replace(patt, '//');
              proxyUrl = proxyUrl.replace(patt, '//');
            }
            if(ioArgs.url.indexOf(sourceUrl) >= 0) {
              ioArgs.url = ioArgs.url.replace(sourceUrl, proxyUrl);
              return true;
            }
          });
        }
        if (appConfig.map.appProxy) {
          array.some(appConfig.map.appProxy.proxyItems, function(proxyItem) {
            if (!proxyItem.useProxy || !proxyItem.proxyUrl) {
              return false;
            }
            var sourceUrl = proxyItem.sourceUrl, proxyUrl = proxyItem.proxyUrl;
            if (parentHttps) {
              sourceUrl = sourceUrl.replace(patt, '//');
              proxyUrl = proxyUrl.replace(patt, '//');
            }
            if (ioArgs.url.indexOf(sourceUrl) >= 0) {
              ioArgs.url = ioArgs.url.replace(sourceUrl, proxyUrl);
              return true;
            }
          });
        }
      }

      return ioArgs;
    });


    // disable middle mouse button scroll
    on(window, 'mousedown', function(evt) {
      if(jimuUtils.isInNavMode()){
        html.removeClass(document.body, 'jimu-nav-mode');
        window.isMoveFocusWhenInit = false;
      }
      if (!mouse.isMiddle(evt)) {
        return;
      }

      evt.preventDefault();
      evt.stopPropagation();
      evt.returnValue = false;
      return false;
    });
    on(window, 'keydown', function(evt) {
      if(evt.keyCode === keys.TAB && !jimuUtils.isInNavMode()){
        html.addClass(document.body, 'jimu-nav-mode');
      }
    });

    if(navigator.serviceWorker){
      window.postMessageToSw({type: 'to_sw_credential', credential: null});

      navigator.serviceWorker.onmessage = function(evt) {
        var message = evt.data;
        if(evt.origin === window.location.origin && message.type === 'to_window_get_credential' && window.portalUrl){
          var portalUrl = portalUrlUtils.getStandardPortalUrl(window.portalUrl);
          var portal = portalUtils.getPortal(portalUrl);
          if(portal.credential){
            window.postMessageToSw({type: 'to_sw_credential', credential: portal.credential.toJson()});
          }else if(window.isCredentialSettled){
            window.postMessageToSw({type: 'to_sw_no_credential'});
          }
        }
      }
    }

    String.prototype.startWith = function(str) {
      if (this.substr(0, str.length) === str) {
        return true;
      } else {
        return false;
      }
    };

    String.prototype.endWith = function(str) {
      if (this.substr(this.length - str.length, str.length) === str) {
        return true;
      } else {
        return false;
      }
    };

    // Polyfill isNaN for IE11
    // Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN
    Number.isNaN = Number.isNaN || function (value) {
      return value !== value;
    };

    /*jshint unused: false*/
    if (typeof jimuConfig === 'undefined') {
      jimuConfig = {};
    }
    jimuConfig = lang.mixin({
      loadingId: 'main-loading',
      loadingImageId: 'app-loading',
      loadingGifId: 'loading-gif',
      layoutId: 'jimu-layout-manager',
      mapId: 'map',
      mainPageId: 'main-page',
      timeout: 5000,
      breakPoints: [600, 1280]
    }, jimuConfig);

    window.wabVersion = '2.30';
    // window.productVersion = '2024 R01';
    window.productVersion = 'ArcGIS Web AppBuilder (Developer Edition) 2.30';
    // window.productVersion = 'ArcGIS Enterprise 10.9.1';

    function initApp() {
      var urlParams, configManager, layoutManager;
      console.log('jimu.js init...');
      urlParams = getUrlParams();

      if(urlParams.mobileBreakPoint){
        try{
          var bp = parseInt(urlParams.mobileBreakPoint, 10);
          jimuConfig.breakPoints[0] = bp;
        }catch(err){
          console.error('mobileBreakPoint URL parameter must be a number.', err);
        }
      }

      if(urlParams.mode){
        html.setStyle(jimuConfig.loadingId, 'display', 'none');
        html.setStyle(jimuConfig.mainPageId, 'display', 'block');
      }
      //the order of initialize these managers does mater because this will affect the order of event listener.
      DataManager.getInstance(WidgetManager.getInstance());
      FeatureActionManager.getInstance();
      SelectionManager.getInstance();
      DataSourceManager.getInstance();
      FilterManager.getInstance();

      layoutManager = LayoutManager.getInstance({
        mapId: jimuConfig.mapId,
        urlParams: urlParams
      }, jimuConfig.layoutId);
      configManager = ConfigManager.getInstance(urlParams);

      layoutManager.startup();
      configManager.loadConfig();
      //load this module here to make load modules and load app parallelly
      require(['dynamic-modules/preload']);

      //temp fix for this issue: https://devtopia.esri.com/WebGIS/arcgis-webappbuilder/issues/14082
      dojoReady(function(){
        setTimeout(function(){
          html.removeClass(document.body, 'dj_a11y');
        }, 50);
      });
    }

    function getUrlParams() {
      var s = window.location.search,
        p;
      // params that don't need to `sanitizeHTML`
      var exceptUrlParams = {
        query: true,
        find: true
      };
      if (s === '') {
        return {};
      }

      p = ioquery.queryToObject(s.substr(1));

      for(var k in p){
        if(!exceptUrlParams[k]){
          p[k] = jimuUtils.sanitizeHTML(p[k]);
        }
      }
      return p;
    }

    if(window.isBuilder){
      topic.subscribe("app/appConfigLoaded", onAppConfigChanged);
      topic.subscribe("app/appConfigChanged", onAppConfigChanged);
    }else{
      topic.subscribe("appConfigLoaded", onAppConfigChanged);
      topic.subscribe("appConfigChanged", onAppConfigChanged);
    }

    function onAppConfigChanged(_appConfig, reason){
      appConfig = _appConfig;

      if(reason === 'loadingPageChange'){
        return;
      }

      html.setStyle(jimuConfig.mainPageId, 'display', 'block');
    }
    //ie css
    var ieVersion = jimuUtils.has('ie');
    if(ieVersion){
      if(ieVersion > 9){
        html.addClass(document.body, 'ie-nav-mode');
      }else{
        html.addClass(document.body, 'ie-low-nav-mode');
      }
      if(ieVersion > 10){
        html.addClass(document.body, 'ie-gte-10');
      }
    }
    mo.initApp = initApp;
    return mo;
  });
