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
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dojo/_base/html',
  'dojo/_base/config',
  'dojo/cookie',
  'dojo/Deferred',
  'dojo/promise/all',
  'dojo/request/xhr',
  'dojo/request/script',
  './utils',
  './privilegeUtils',
  './WidgetManager',
  './shared/utils',
  './tokenUtils',
  './portalUtils',
  './appConfigResourceUtils',
  './portalUrlUtils',
  './AppStateManager',
  'esri/IdentityManager',
  'esri/config',
  'esri/urlUtils',
  'esri/arcgis/utils'
],
function (declare, lang, array, html, dojoConfig, cookie,
  Deferred, all, xhr, dojoScript, jimuUtils, privilegeUtils, WidgetManager, sharedUtils, tokenUtils,
  portalUtils, appConfigResourceUtils, portalUrlUtils, AppStateManager, IdentityManager, esriConfig, esriUrlUtils,
  arcgisUtils) {
  var instance = null, clazz;

  clazz = declare(null, {
    urlParams: null,
    appConfig: null,
    rawAppConfig: null,
    configFile: null,
    _configLoaded: false,
    portalSelf: null,

    constructor: function (urlParams, options) {
      this._removeHash(urlParams);
      this.urlParams = urlParams || {};
      this.widgetManager = WidgetManager.getInstance();
      lang.mixin(this, options);
    },

    /****************************************************
    * The app accept the following URL parameters:
    * ?config=<abc-config.json>, this is a config file url
    * ?id=<123>, the id is WAB app id, which is created from portal.
          URL has this parameter means open WAB app from portal.
    * ?appid=<123>, the appid is portal/AGOL app id, which is created from portal/AGOL template.
          The template is created from WAB's app.
          When URL has this parameter, we'll check whether the app is launched
          in portal/AGOL, or not in portal/AGOL.
          > IF in portal, we'll use the appid to get portal/AGOL template id and app data,
          then get WAB app id, then get WAB app config, then merge config;
          > IF NOT in portal, we'll use the appid to get app data, then merge the data
          to WAB app config.
        How to check whether the app is in portal?
          When try to load config file, if URL has no config or id parameter, we'll load
          <app>/config.json file. If the app is in XT, the portalUrl in config.json is not empty.
          If the app is in portal/AGOL, the app is stemapp indeed, which portalUrl is empty.
          So, if portal url is empty, we consider the app is in portal. However, the exception is
          launch stemapp directly. The solution is the XT builder will write "wab_portalurl" cookie
          for stemapp. So, if we find this cookie, we know the app is not in portal.
    * ?itemid=<itemid>, this webmap item will override the itemid in app config
    * ?mode=<config|preview>, this is for internal using purpose
    * ?URL parameters that affect map extent
    ********************************************************/
    loadConfig: function () {
      console.time('Load Config');
      return this._tryLoadConfig().then(lang.hitch(this, function(appConfig) {
        var err = this.checkConfig(appConfig);
        if (err) {
          throw Error(err);
        }
        this.rawAppConfig = lang.clone(appConfig);
        AppStateManager.getInstance().setRawAppConfig(this.rawAppConfig);
        appConfig = this._upgradeAppConfig(appConfig);
        this._processAfterTryLoad(appConfig);
        this.appConfig = appConfig;

        if(this.urlParams.id){
          return this.loadWidgetsManifest(appConfig).then(lang.hitch(this, function() {
            return this.loadAndUpgradeAllWidgetsConfig(appConfig);
          })).then(lang.hitch(this, function(appConfig) {
            return this.updateNecessaryAttrOfResourceUrlInAppConfig(appConfig, this.urlParams.id);
          })).then(lang.hitch(this, function() {
            this._configLoaded = true;
            this._setDocumentTitle(appConfig);

            this._readAndSetSharedTheme(appConfig);
            return this.getAppConfig();
          }));
        }else{
          tokenUtils.setPortalUrl(appConfig.portalUrl);
          arcgisUtils.arcgisUrl = portalUrlUtils.getBaseItemUrl(appConfig.portalUrl);
          return this._proesssWebTierAndSignin(appConfig).then(lang.hitch(this, function() {
            if(this.urlParams.appid){
              //url has appid parameter means open app as an app created from AGOL template
              if(!window.appInfo.isRunInPortal){
                return this._processNotInPortalAppProtocol(appConfig).
                then(lang.hitch(this, function(appConfig){
                  return this._getAppDataAddTemplateDataFromTemplateAppId
                  (appConfig.portalUrl, this.urlParams.appid).
                  then(lang.hitch(this, function(result){
                    if(result.appData.appConfig){
                      appConfig = result.appData.appConfig;
                    }
                    appConfig._appData = result.appData;
                    appConfig.templateConfig = result.templateData;
                    appConfig.isTemplateApp = true;
                    return appConfig;
                  }));
                }));
              }else{
                var portalUrl = portalUrlUtils.getStandardPortalUrl(appConfig.portalUrl);
                var portal = portalUtils.getPortal(portalUrl);

                // checkIsSelfOrigin
                return privilegeUtils.checkIsSelfOrigin(this.urlParams.appid,
                                                                portal,
                                                                tokenUtils.isInBuilderWindow())
                .then(lang.hitch(this, function(isSelfOrigin) {
                  if(!isSelfOrigin) {
                    var error = new Error(window.jimuNls.orgUrlMessage);
                    error.isSelfOrigin = false;
                    throw error;
                  }
                })).then(lang.hitch(this, function() {
                  // checkEssentialAppsLicense
                  return privilegeUtils.checkEssentialAppsLicense(this.urlParams.appid,
                                                                  portal,
                                                                  tokenUtils.isInBuilderWindow())
                  .then(lang.hitch(this, function() {
                    return this._getAppConfigFromTemplateAppId(appConfig.portalUrl,
                    this.urlParams.appid).then(lang.hitch(this, function(appConfig){
                      this._tryUpdateAppConfigByLocationUrl(appConfig);
                      return this._processInPortalAppProtocol(appConfig);
                    }));
                  }), lang.hitch(this, function(error) {
                    console.error(error);
                    if(error.isBlockedByOrg) {
                      throw Error(window.jimuNls.blockedByAdminErrorForApp);
                    } else {
                      throw Error(window.jimuNls.essentialAppsLicenseErrorForApp);
                    }
                  }));
                }));
              }
            }else{
              return this._processNotInPortalAppProtocol(appConfig);
            }
          })).then(lang.hitch(this, function(appConfig) {
            this._processAfterTryLoad(appConfig);
            this.appConfig = appConfig;
            if(appConfig.map.itemId){
              return appConfig;
            }else{
              var webmapDef;
              if(appConfig.map["3D"]) {
                webmapDef = portalUtils.getDefaultWebScene(appConfig.portalUrl);
              } else {
                webmapDef = portalUtils.getDefaultWebMap(appConfig.portalUrl);
              }

              return webmapDef.then(function(itemId){
                appConfig.map.itemId = itemId;
                return appConfig;
              });
            }
          })).then(lang.hitch(this, function(appConfig) {
            return this.loadWidgetsManifest(appConfig);
          })).then(lang.hitch(this, function(appConfig) {
            //if it's an AGOL template app, the appConfig will have one property:_appData
            //if it's an WAB template app, the appConfig will have one property:isTemplateApp
            if(appConfig._appData){
              if(appConfig._appData.values && appConfig._appData.values.webmap){
                return portalUtils.getPortal(appConfig.portalUrl)
                .getItemById(appConfig._appData.values.webmap)
                .then(lang.hitch(this, function(webmapInfo){
                  return jimuUtils.template
                    .mergeTemplateAppConfigToAppConfig(appConfig, appConfig._appData, webmapInfo);
                }));
              }else{
                return jimuUtils.template
                    .mergeTemplateAppConfigToAppConfig(appConfig, appConfig._appData);
              }
            }else {
              return appConfig;
            }
          })).then(lang.hitch(this, function(appConfig) {
            return this.loadAndUpgradeAllWidgetsConfig(appConfig);
          })).then(lang.hitch(this, function(appConfig) {
            if(appConfig._wabAppId){//for AGOL template
              return this.processResourceInAppConfigForConfigLoader(appConfig, this.urlParams);
            }else if(appConfig.appItemId && window.JSON.stringify(appConfig).indexOf('${itemId}') > -1){
              //for app download from portal/agol and deployed standalone
              return this.updateNecessaryAttrOfResourceUrlInAppConfig(appConfig, appConfig.appItemId);
            }else{
              return appConfig;
            }
          })).then(lang.hitch(this, function(appConfig) {
            this.appConfig = appConfig;
            this._configLoaded = true;
            this._setDocumentTitle(appConfig);
            this._readAndSetSharedTheme(appConfig);
            return this.getAppConfig();
          }));
        }
      }), lang.hitch(this, function(err){
        //this.showError(err);
        //we still return a rejected deferred
        var def = new Deferred();
        def.reject(err);
        return def;
      }));
    },
    processResourceInAppConfigForConfigLoader:function(appConfig, urlParams){
      var portalUrl = appConfig.portalUrl;
      //statement:The original app is app1, the template based app is app2
      var app1Id = appConfig.appItemId;
      var app2Id = urlParams.appid;
      var deferred = new Deferred();
      var cloneAppConfig = lang.clone(appConfig);
      //1.Traverse appConfig of app1, get all the resources URL, replace its ${itemId} with app2Id
      this.updateNecessaryAttrOfResourceUrlInAppConfig(cloneAppConfig, app2Id).then(function(){

        //2.if in builder env, continue to handle resource of app1 and app2
        if(urlParams.mode === 'config'){
          //3.get all resource url from app1, if app1's resource is not empty, continue
          var app1Resources = this.getResourceUrlsOfAppConfig(appConfig).result;
          if(app1Resources.length !== 0){
            portalUtils.getItemResources(portalUrl, app2Id).then(function(app2Resources){
              //4.If the app2's resource is empty, this is the first time to open app2,so
              //copy all app1's resources to the app2
              if(app2Resources.length === 0){
                app1Resources = app1Resources.map(function(item){
                  return {
                      resUrl:item
                    };
                });
                return appConfigResourceUtils.AddResourcesToItemForAppSave(portalUrl,
                  app1Resources, app1Id, app2Id).then(function(){
                  deferred.resolve(cloneAppConfig);
                },function(error){
                  console.warn('Add resource to template based app error:' + error.message || error);
                  deferred.resolve(cloneAppConfig);
                });
              }else{
                deferred.resolve(cloneAppConfig);
              }
            },function(error){
              console.warn('Get resource of template based item error:' + error.message || error);
              deferred.resolve(cloneAppConfig);
            });
          }else{
            deferred.resolve(cloneAppConfig);
          }
        }else{
          deferred.resolve(cloneAppConfig);
        }
      }.bind(this),function(error){
        console.warn('Insert appId to resource url of appConfig error:' + error.message || error);
        deferred.resolve(cloneAppConfig);
      });
      return deferred;
    },
    getResourceUrlsOfAppConfig: function(appConfig) {
      function isResources(value) {
        var regExpStr = /^https?:\/\/(.)+\/sharing\/rest\/content\/items\/(.)+\/resources\/inConfig\//;
        return regExpStr.test(value);
      }

      function getResourceUrl(pendingObj) {
        return pendingObj.value;
      }

      var cb = {
        test: isResources,
        func: lang.hitch(this, getResourceUrl)
      };

      return jimuUtils.processItemResourceOfAppConfig(appConfig, cb);
    },
    updateNecessaryAttrOfResourceUrlInAppConfig: function(appConfig, appId) {
      //Traverse appConfig, get all the resources URL, replace its ${itemId} and token and protocol
      //For protocol, if portal's protocal is https, forces the protocol of all resources to https
      var portalUrl = appConfig.portalUrl;
      var self = this;

      function _updateAppConfigWithNewValue(updatingObj, newValue){
        var obj = updatingObj.obj;
        var key = updatingObj.key;
        if(typeof updatingObj.i === 'number'){
          obj[key][updatingObj.i] = newValue;
        } else {
          obj[key] = newValue;
        }
      }
      //callback:test, is a resource url or not
      function isResources(value) {
        var regExpStr = /^https?:\/\/(.)+\/sharing\/rest\/content\/items\/(.)+\/resources\/inConfig\//;
        return regExpStr.test(value);
      }
      //callback:func, process the resource
      function updateItemIdAndTokenOfResources(args, pendingObj) {
        var retUrl = self.processItemIDAndTokenOfResources(pendingObj.value, args);
        retUrl = self.setResouceProtocolForHttps(retUrl);
        _updateAppConfigWithNewValue(pendingObj, retUrl);
        return true;
      }
      return portalUtils.getPortal(portalUrl).getItemById(appId).then(lang.hitch(this, function(appItemInfo) {
        var appInfo = {
          appId: appId,
          isPublic: appItemInfo.access === 'public',
          portalUrl: portalUrl
        };
        var cb = {
          test:isResources,
          func: lang.hitch(this, updateItemIdAndTokenOfResources, appInfo)
        };
        var result = jimuUtils.processItemResourceOfAppConfig(appConfig, cb);
        return result.appConfig;
      }));
    },

    setResouceProtocolForHttps:function(retUrl){
      var url = retUrl;
      var protocol = window.location.protocol;
      if(protocol === 'https:'){
        url = retUrl.replace(/^http(s?):\/\//i, 'https://');
      }
      return url;
    },

    processItemIDAndTokenOfResources:function(resUrl, appInfo){
      //replace resUrl's ${itemId} and token
      if (resUrl.indexOf('${itemId}') > 0) {
        resUrl = resUrl.replace('${itemId}', appInfo.appId);
      }
      if (/(\?|\&)token=.+/.test(resUrl)) {
        resUrl = resUrl.replace(/(\?|\&)token=.+/, '');
      }
      if (!appInfo.isPublic) {
        var credential = tokenUtils.getPortalCredential(appInfo.portalUrl);
        if (credential) {
          resUrl += '?token=' + credential.token;
        }
      }
      return resUrl;
    },
    _setDocumentTitle: function(appConfig) {
      if(!window.isBuilder) {
        //launch
        if (appConfig && appConfig.title) {
          document.title = jimuUtils.stripHTML(appConfig.title);
        }
      }
      //startup\Plugin.js change doc.title when in config mode.
    },

    getAppConfig: function(){
      var c = lang.clone(this.appConfig);
      c.getConfigElementById = function(id){
        return jimuUtils.getConfigElementById(this, id);
      };

      c.getConfigElementsByName = function(name){
        return jimuUtils.getConfigElementsByName(this, name);
      };

      c.visitElement = function(cb){
        jimuUtils.visitElement(this, cb);
      };

      this._addAuthorizedCrossOriginDomains(this.portalSelf, c);

      return c;
    },

    _addAuthorizedCrossOriginDomains: function(portalSelf, appConfig){
      // we read withCredentials domains(mostly web-tier) and put them into corsEnabledServers
      // tokenUtils.addAuthorizedCrossOriginDomains will ignore duplicated values
      if(portalSelf && portalSelf.authorizedCrossOriginDomains){
        tokenUtils.addAuthorizedCrossOriginDomains(portalSelf.authorizedCrossOriginDomains);
      }
      if(appConfig && appConfig.authorizedCrossOriginDomains){
        tokenUtils.addAuthorizedCrossOriginDomains(appConfig.authorizedCrossOriginDomains);
      }
    },

    checkConfig: function(){
      return false;
    },

    processProxy: function(appConfig){
      esriConfig.defaults.io.alwaysUseProxy = appConfig.httpProxy &&
      appConfig.httpProxy.useProxy && appConfig.httpProxy.alwaysUseProxy;
      esriConfig.defaults.io.proxyUrl = "";
      esriConfig.defaults.io.proxyRules = [];

      if (appConfig.httpProxy && appConfig.httpProxy.useProxy && appConfig.httpProxy.url) {
        esriConfig.defaults.io.proxyUrl = appConfig.httpProxy.url;
      }
      if (appConfig.httpProxy && appConfig.httpProxy.useProxy && appConfig.httpProxy.rules) {
        array.forEach(appConfig.httpProxy.rules, function(rule) {
          esriUrlUtils.addProxyRule(rule);
        });
      }
    },

    addNeedValues: function(appConfig){
      this._processNoUriWidgets(appConfig);
      this._processEmptyGroups(appConfig);
      this._addElementId(appConfig);

      //do't know why repreated id is generated sometimes, so fix here.
      this._fixRepeatedId(appConfig);
    },

    showError: function(err){
      if(err && err.message){
        html.create('div', {
          'class': 'app-error',
          innerHTML: jimuUtils.stripHTML(err.message)
        }, document.body);
        /*globals jimuConfig*/
        html.setStyle(jimuConfig.loadingId, 'display', 'none');
      }
    },

    _tryLoadConfig: function() {
      if(this.urlParams.id === 'stemapp'){
        this.urlParams.config = window.appInfo.appPath + 'config.json';
        delete this.urlParams.id;
      }
      if(this.urlParams.config) {
        this.configFile = this.urlParams.config;
        return xhr(this.configFile, {
          handleAs: 'json',
          headers: {
            "X-Requested-With": null
          }
        }).then(lang.hitch(this, function(appConfig){
          tokenUtils.setPortalUrl(appConfig.portalUrl);
          if(appConfig.portalUrl){
            window.portalUrl = appConfig.portalUrl;
          }

          if(this.urlParams.token){
            return tokenUtils.registerToken(this.urlParams.token).then(function(){
              return appConfig;
            });
          }else{
            return appConfig;
          }
        }));
      }else if(this.urlParams.id){
        //app is hosted in portal
        window.appInfo.isRunInPortal = true;
        var portalUrl = portalUrlUtils.getPortalUrlFromLocation();
        var def = new Deferred();
        tokenUtils.setPortalUrl(portalUrl);
        window.portalUrl = portalUrl;
        arcgisUtils.arcgisUrl = portalUrlUtils.getBaseItemUrl(portalUrl);

        var tokenDef;
        if(this.urlParams.token){
          tokenDef = tokenUtils.registerToken(this.urlParams.token);
        }else{
          tokenDef = new Deferred();
          tokenDef.resolve();
        }

        tokenDef.then(lang.hitch(this, function(){
          //we don't process webtier in portal because portal has processed.
          var portal = portalUtils.getPortal(portalUrl);
          portal.loadSelfInfo().then(lang.hitch(this, function(portalSelf){
            this.portalSelf = portalSelf;
            //if the portal uses web-tier authorization, we can get allSSL info here
            if(portalSelf.allSSL && window.location.protocol === "http:"){
              console.log("redirect from http to https");
              window.location.href = portalUrlUtils.setHttpsProtocol(window.location.href);
              def.reject();
              return;
            }
            this._processSignIn(portalUrl).then(lang.hitch(this, function(){
              //integrated in portal, open as a WAB app
              this._getAppConfigFromAppId(portalUrl, this.urlParams.id)
              .then(lang.hitch(this, function(appConfig){

                //checkIsSelfOrigin
                return privilegeUtils.checkIsSelfOrigin(this.urlParams.id,
                                                                portal,
                                                                tokenUtils.isInBuilderWindow())
                .then(lang.hitch(this, function(isSelfOrigin) {
                  if(isSelfOrigin) {
                    return appConfig;
                  } else {
                    var error = new Error(window.jimuNls.orgUrlMessage);
                    error.isSelfOrigin = false;
                    throw error;
                  }
                }));
              })).then(lang.hitch(this, function(appConfig){

                // checkEssentialAppsLicense
                return privilegeUtils.checkEssentialAppsLicense(this.urlParams.id,
                                                                portal,
                                                                tokenUtils.isInBuilderWindow())
                .then(lang.hitch(this, function() {
                  this._tryUpdateAppConfigByLocationUrl(appConfig);
                  return this._processInPortalAppProtocol(appConfig);
                }), lang.hitch(this, function(error) {
                  console.error(error);
                  if(error.isBlockedByOrg) {
                    throw Error(window.jimuNls.blockedByAdminErrorForApp);
                  } else {
                    throw Error(window.jimuNls.essentialAppsLicenseErrorForApp);
                  }
                }));
              })).then(function(appConfig){
                def.resolve(appConfig);
              }, function(err){
                def.reject(err);
              });
            }));
          }));
        }), lang.hitch(this, function(err){
          this.showError(err);
        }));
        return def;
      } else{
        this.configFile = "config.json";
        return xhr(this.configFile, {handleAs: 'json'}).then(lang.hitch(this, function(appConfig){
          tokenUtils.setPortalUrl(appConfig.portalUrl);
          if(appConfig.portalUrl){
            window.portalUrl = appConfig.portalUrl;
          }
          if(this.urlParams.token){
            return tokenUtils.registerToken(this.urlParams.token).then(function(){
              return appConfig;
            });
          }else{
            return appConfig;
          }
        }));
      }
    },

    _upgradeAppConfig: function(appConfig){
      var appVersion = window.wabVersion;
      var configVersion = appConfig.wabVersion;
      var newConfig;

      //save wabVersion in app config json here
      appConfig.configWabVersion = appConfig.wabVersion;

      if(appVersion === configVersion){
        return appConfig;
      }
      var configVersionIndex = this.versionManager.getVersionIndex(configVersion);
      var appVersionIndex = this.versionManager.getVersionIndex(appVersion);
      if(configVersionIndex > appVersionIndex){
        throw Error('Bad version number, ' + configVersion);
      }else{
        newConfig = this.versionManager.upgrade(appConfig, configVersion, appVersion);
        newConfig.wabVersion = appVersion;
        return newConfig;
      }
    },

    loadAndUpgradeAllWidgetsConfig: function(appConfig){
      var def = new Deferred(), defs = [];

      sharedUtils.visitElement(appConfig, lang.hitch(this, function(e){
        if(!e.uri){
          return;
        }
        var upgradeDef = this.widgetManager.tryLoadWidgetConfig(e);
        defs.push(upgradeDef);
      }));
      all(defs).then(lang.hitch(this, function(){
        def.resolve(appConfig);
      }), function(err){
        def.reject(err);
      });
      return def;
    },

    _processAfterTryLoad: function(appConfig){
      this._setPortalUrl(appConfig);
      this._tryUpdateAppConfigByLocationUrl(appConfig);
      this._processUrlParams(appConfig);

      this.addNeedValues(appConfig);
      this.processProxy(appConfig);

      IdentityManager.tokenValidity = 60 * 24 * 7;//token is valid in 7 days
      return appConfig;
    },

    _readAndSetSharedTheme: function(appConfig){
      if(!appConfig.theme.sharedTheme){
        appConfig.theme.sharedTheme = {
          useHeader: false,
          useLogo: false
        };
        if(this.portalSelf.portalProperties && this.portalSelf.portalProperties.sharedTheme){
          appConfig.theme.sharedTheme.isPortalSupport = true;
        }else{
          appConfig.theme.sharedTheme.isPortalSupport = false;
        }
      } else {
        if(!this.portalSelf.portalProperties || !this.portalSelf.portalProperties.sharedTheme){
          appConfig.theme.sharedTheme.isPortalSupport = false;
        }
      }

      if(appConfig.theme.sharedTheme.useHeader){
        if(appConfig.theme.sharedTheme.isPortalSupport && this.portalSelf.portalProperties){
          appConfig.theme.customStyles = {
            mainBackgroundColor: this.portalSelf.portalProperties.sharedTheme.header.background
          };
          appConfig.titleColor = this.portalSelf.portalProperties.sharedTheme.header.text;
        }else{
          console.error('Portal does not support sharedTheme.');
        }
      }

      if(appConfig.theme.sharedTheme.useLogo){
        if(appConfig.theme.sharedTheme.isPortalSupport && this.portalSelf.portalProperties){
          if(this.portalSelf.portalProperties.sharedTheme.logo.small){
            appConfig.logo = this.portalSelf.portalProperties.sharedTheme.logo.small;
          }else{
            appConfig.logo = 'images/app-logo.png';
          }

          if(!appConfig.logoLink && this.portalSelf.portalProperties.sharedTheme.logo.link){
            appConfig.logoLink = this.portalSelf.portalProperties.sharedTheme.logo.link;
          }
        }else{
          console.error('Portal does not support sharedTheme, use default logo.');
          appConfig.logo = 'images/app-logo.png';
        }
      }
    },

    _tryUpdateAppConfigByLocationUrl: function(appConfig){
      if(this.urlParams.config &&
        this.urlParams.config.indexOf('arcgis.com/sharing/rest/content/items/') > -1){

        //for load config from arcgis.com, for back compatibility test.
        return;
      }

      //app is hosted in portal
      //we process protalUrl specially because user in a group owned by two orgs should
      //open the app correctly if the app is shared to this kind of group.
      //so we need to keep main protalUrl consistent with portalUrl browser location.
      var portalUrlFromLocation = portalUrlUtils.getPortalUrlFromLocation();
      var processedPortalUrl = portalUrlUtils.getStandardPortalUrl(portalUrlFromLocation);

      if(portalUrlUtils.isOnline(processedPortalUrl)){
        processedPortalUrl = portalUrlUtils.updateUrlProtocolByOtherUrl(processedPortalUrl,
                                                                        appConfig.portalUrl);
        if(appConfig.map.portalUrl){
          if(portalUrlUtils.isSamePortalUrl(appConfig.portalUrl, appConfig.map.portalUrl)){
            appConfig.map.portalUrl = processedPortalUrl;
          }
        }
        appConfig.portalUrl = processedPortalUrl;

        //update proxy url
        if(appConfig.httpProxy && appConfig.httpProxy.url){
          appConfig.httpProxy.url = portalUrlUtils.getPortalProxyUrl(processedPortalUrl);
        }
      }
    },

    _processWidgetJsons: function(appConfig){
      sharedUtils.visitElement(appConfig, function(e, info){
        if(info.isWidget && e.uri){
          jimuUtils.widgetJson.processWidgetJson(e);
        }
      });
    },

    _processNoUriWidgets: function(appConfig){
      var i = 0;
      sharedUtils.visitElement(appConfig, function(e, info){
        if(info.isWidget && !e.uri){
          i ++;
          e.placeholderIndex = i;
        }
      });
    },

    _processEmptyGroups: function(appConfig){
      var i = 0;
      if(!appConfig.widgetOnScreen.groups){
        return;
      }
      array.forEach(appConfig.widgetOnScreen.groups, function(g){
        if(!g.widgets || g.widgets && g.widgets.length === 0){
          i ++;
          g.placeholderIndex = i;
        }
      });
    },

    _addElementId: function (appConfig){
      var maxId = 0, i;

      sharedUtils.visitElement(appConfig, function(e){
        if(!e.id){
          return;
        }
        //fix element id
        e.id = e.id.replace(/\//g, '_');

        var li = e.id.lastIndexOf('_');
        if(li > -1){
          i = e.id.substr(li + 1);
          maxId = Math.max(maxId, i);
        }
      });

      sharedUtils.visitElement(appConfig, function(e){
        if(!e.id){
          maxId ++;
          if(e.itemId){
            e.id = e.itemId + '_' + maxId;
          }else if(e.uri){
            e.id = e.uri.replace(/\//g, '_') + '_' + maxId;
          }else{
            e.id = ''  + '_' + maxId;
          }
        }
      });
    },

    _setPortalUrl: function(appConfig){
      if(appConfig.portalUrl){
        //we can judge the app is running in portal or not now.
        //we should consider this case: the app is running in arcgis.com and the app is shared to
        //an cross-org group and the member of another org of this group is opening this app.
        //In this case, appConfig.portalUrl is different with portalUrlByLocation, but the app is
        //running in portal(arcgis.com).
        var portalUrlByLocation = portalUrlUtils.getPortalUrlFromLocation();
        var isOnline = portalUrlUtils.isOnline(portalUrlByLocation);
        if(!portalUrlUtils.isSamePortalUrl(appConfig.portalUrl, portalUrlByLocation) && !isOnline){
          //app is deployed outside of portal
          window.appInfo.isRunInPortal = false;
        }
        return;
      }
      //if there is no portalUrl in appConfig, try to check whether the app
      //is launched from XT version builder
      if(window.isXT && cookie('wab_portalurl')){
        appConfig.portalUrl = cookie('wab_portalurl');
        return;
      }

      //if not launched from XT builder and has no portalUrl is set,
      //let's assume it's hosted in portal, use the browser location
      window.appInfo.isRunInPortal = true;
      appConfig.portalUrl = portalUrlUtils.getPortalUrlFromLocation();
      return;
    },

    _changePortalUrlProtocol: function(appConfig, protocol){
      //if browser uses https protocol, portalUrl should also use https
      appConfig.portalUrl = portalUrlUtils.setProtocol(appConfig.portalUrl, protocol);

      if(appConfig.map.portalUrl){
        appConfig.map.portalUrl = portalUrlUtils.setProtocol(appConfig.map.portalUrl, protocol);
      }

      if(appConfig.httpProxy){
        var httpProxyUrl = appConfig.httpProxy.url;

        appConfig.httpProxy.url = portalUrlUtils.setProtocol(httpProxyUrl, protocol);

        if(appConfig.httpProxy && appConfig.httpProxy.rules){
          array.forEach(appConfig.httpProxy.rules, lang.hitch(this, function(rule){
            rule.proxyUrl = portalUrlUtils.setProtocol(rule.proxyUrl, protocol);
          }));
        }
      }
    },

    _processInPortalAppProtocol: function(appConfig){
      var def = new Deferred();
      var portalUrl = appConfig.portalUrl;
      var portal = portalUtils.getPortal(portalUrl);

      //for hosted app, we need to check allSSL property
      var handleAllSSL = lang.hitch(this, function(allSSL){
        if(window.location.protocol === 'https:'){
          this._changePortalUrlProtocol(appConfig, 'https');
        }else{
          if(allSSL){
            //keep the protocol of browser honor allSSL property
            console.log("redirect from http to https");
            window.location.href = portalUrlUtils.setHttpsProtocol(window.location.href);
            def.reject();
            return;
          }else{
            this._changePortalUrlProtocol(appConfig, 'http');
          }
        }
        this._checkLocale();
        def.resolve(appConfig);
      });

      //we have called checkSignInStatus in _processSignIn before come here
      portal.loadSelfInfo().then(lang.hitch(this, function(portalSelf){
        this.portalSelf = portalSelf;
        //we need to check anonymous property for orgnization first,
        if(portalSelf.access === 'private'){
          //we do not force user to sign in,
          //we just check protocol of portalUrl in appConfig as allSSL
          var isPortalHttps = appConfig.portalUrl.toLowerCase().indexOf('https://') === 0;
          handleAllSSL(isPortalHttps);
        }
        else{
          //Allow anonymous access to portal.
          handleAllSSL(portalSelf.allSSL);
        }
      }), lang.hitch(this, function(err){
        def.reject(err);
      }));
      return def;
    },

    _processNotInPortalAppProtocol: function(appConfig){
      var def = new Deferred();
      if(appConfig.portalUrl){
        var portal = portalUtils.getPortal(appConfig.portalUrl);
        portal.loadSelfInfo().then(lang.hitch(this, function(portalSelf){
          this.portalSelf = portalSelf;
          var isBrowserHttps = window.location.protocol === 'https:';
          var allSSL = !!portalSelf.allSSL;
          if(allSSL || isBrowserHttps){
            this._changePortalUrlProtocol(appConfig, 'https');
          }

          var isPortalHttps = appConfig.portalUrl.toLowerCase().indexOf('https://') === 0;
          if(isPortalHttps && !isBrowserHttps){
            //for app in configWindow and previewWindow, we should not refresh url because there is
            //a DOMException if protocol of iframe is not same as protocol of builder window
            //such as:Blocked a frame with origin "https://***" from accessing a cross-origin frame.
            if(!tokenUtils.isInConfigOrPreviewWindow()){
              //if portal uses https protocol, the browser must use https too
              console.log("redirect from http to https");
              window.location.href = portalUrlUtils.setHttpsProtocol(window.location.href);
              def.reject();
              return;
            }
          }
          def.resolve(appConfig);
        }), lang.hitch(this, function(err){
          def.reject(err);
        }));
      }
      else{
        def.resolve(appConfig);
      }
      return def;
    },

    //this function will be not called if app is in portal.
    _proesssWebTierAndSignin: function(appConfig){
      var def = new Deferred();
      var isWebTier = false;
      var portalUrl = appConfig.portalUrl;
      this._processWebTier(appConfig).then(lang.hitch(this, function(webTier){
        isWebTier = webTier;
        var portal = portalUtils.getPortal(portalUrl);
        return portal.loadSelfInfo();
      })).then(lang.hitch(this, function(portalSelf) {
        this.portalSelf = portalSelf;
        return this._processSignIn(portalUrl, isWebTier);
      })).then(lang.hitch(this, function() {
        def.resolve();
      }), function(err){
        def.reject(err);
      });
      return def;
    },

    _processWebTier: function(appConfig){
      var def = new Deferred();
      var portalUrl = appConfig.portalUrl;
      if(appConfig.isWebTier){
        //If appConfig.isWebTier is true, we should assume the portal uses web-tier authentication
        //no matter what value tokenUtils.isWebTierPortal returns, because the portal maybe
        //disable auto account registration. #4202
        tokenUtils.addAuthorizedCrossOriginDomains([portalUrl]);
        //Although it is recommended to enable ssl for IWA/PKI portal by Esri,
        //there is no force on the client. They still can use http for IWA/PKI.
        //It is not correnct to assume web-tier authorization only works with https.
        tokenUtils.isWebTierPortal(portalUrl).then(lang.hitch(this, function() {
          var credential = tokenUtils.getPortalCredential(portalUrl);
          //if portal uses web-tier but the user doesn't have an account in this portal,
          //credential will be null
          if(credential && credential.ssl){
            //if credential.ssl, it means that the portal is allSSL enabled
            if(window.location.protocol === 'http:' && !tokenUtils.isInConfigOrPreviewWindow()){
              console.log("redirect from http to https");
              window.location.href = portalUrlUtils.setHttpsProtocol(window.location.href);
              return;
            }
          }
          //resolve appConfig.isWebTier, not the resoponse of tokenUtils.isWebTierPortal
          def.resolve(appConfig.isWebTier);
        }), lang.hitch(this, function(err) {
          def.reject(err);
        }));
      }else{
        def.resolve(false);
      }
      return def;
    },

    _processSignIn: function(portalUrl, isWebTier){
      var def = new Deferred();
      var portal = portalUtils.getPortal(portalUrl);
      var sharingUrl = portalUrlUtils.getSharingUrl(portalUrl);
      var defSignIn;
      var tokenUrl = portalUrl + "/sharing/generateToken?f=json";
      var httpsTokenUrl = portalUrlUtils.setHttpsProtocol(tokenUrl);

      if(window.appInfo.isRunInPortal){
        // if(window !== window.top){
        //   var isInBuilder;
        //   try{
        //     if(window.top.isBuilder){
        //       isInBuilder = true;
        //     }else{
        //       isInBuilder = false;
        //     }
        //   }catch(e){
        //     //cross domain, means not in builder
        //     isInBuilder = false;
        //   }

        //   if(!isInBuilder){
        //     IdentityManager.useSignInPage = false;
        //     tokenUtils.registerOAuthInfo(portalUrl, "arcgisWebApps");
        //   }
        // }

        //we don't register oauth info for app run in portal.
        defSignIn = IdentityManager.checkSignInStatus(sharingUrl);
        defSignIn.promise.then(lang.hitch(this, function(credential){
          if(!credential.token){
            dojoScript.get(httpsTokenUrl, {
              jsonp: 'callback'
            }).then(lang.hitch(this, function(response){
              if(response && response.token){
                // add token to credential for WebTier Portal
                credential.token = response.token;
                if(!credential.expires){
                  credential.expires = response.expires;
                }
                def.resolve();
              } else {
                def.resolve();
              }
            }), lang.hitch(this, function(err){
              //network error
              console.error(err);
              def.resolve();
            }));
          } else {
            window.postMessageToSw({type: 'to_sw_credential', credential: credential.toJson()});
            def.resolve();
          }
        }), lang.hitch(this, function() {
          window.postMessageToSw({type: 'to_sw_no_credential'});
          window.isCredentialSettled = true;
          def.resolve();
        }));
      }else{
        // do not support online custom widget for DE
        window.postMessageToSw({type: 'to_sw_no_credential'});
        window.isCredentialSettled = true;

        if (!tokenUtils.isInBuilderWindow() && !tokenUtils.isInConfigOrPreviewWindow() &&
          this.portalSelf.supportsOAuth && this.rawAppConfig && this.rawAppConfig.appId && !isWebTier) {
          tokenUtils.registerOAuthInfo(portalUrl, this.rawAppConfig.appId, this.portalSelf.currentVersion);
        }
        //we call checkSignInStatus here because this is the first place where we can get portal url
        defSignIn = IdentityManager.checkSignInStatus(sharingUrl);
        defSignIn.promise.always(lang.hitch(this, function(){
          tokenUtils.xtGetCredentialFromCookie(portalUrl);
          //call portal self again because the first call is not sign in,
          //this call maybe have signed in.
          portal.loadSelfInfo().then(lang.hitch(this, function(portalSelf) {
            this.portalSelf = portalSelf;
            this._checkLocale();
            def.resolve();
          }));
        }));
      }
      return def;
    },

    _checkLocale: function(){
      if(tokenUtils.isInConfigOrPreviewWindow()){
        //in builder, app will use wab_locale
        return;
      }

      var appLocale = this.portalSelf.user && this.portalSelf.user.culture ||
          dojoConfig.locale;

      appLocale = appLocale === 'hi' ? 'en' : appLocale.toLowerCase();

      if(!this.urlParams.locale && jimuUtils.isLocaleChanged(dojoConfig.locale, appLocale)){
        cookie('wab_app_locale', appLocale);
        window.location.reload();
      }
    },

    _getAppConfigFromTemplateAppId: function(portalUrl, appId){
      var portal = portalUtils.getPortal(portalUrl);
      //the appid means: the app created by AGOL template.
      return this._getWabAppIdAndDataFromTemplateAppId(portalUrl, appId).
      then(lang.hitch(this, function(response){
        var wabAppId = response.appId;
        var appData = response.appData;

        return all([this._getAppConfigFromAppId(portalUrl, wabAppId),
          portal.getItemData(appData.source)]).then(lang.hitch(this, function(results){
          var appConfig;
          if(appData.appConfig){//appConfig is stored in template app
            appConfig = appData.appConfig;
            delete appData.appConfig;
          }else{//appConfig is in template
            appConfig = results[0];
          }

          appConfig = this._upgradeAppConfig(appConfig);

          var templateConfig = results[1];

          appConfig._appData = appData;
          appConfig._wabAppId = wabAppId;
          appConfig.templateConfig = templateConfig;
          appConfig.isTemplateApp = true;
          return appConfig;
        }));
      }));
    },

    _getAppDataAddTemplateDataFromTemplateAppId: function(portalUrl, appId){
      //the appid means: the app created by AGOL template.
      var portal = portalUtils.getPortal(portalUrl);
      return portal.getItemData(appId).then(function(appData){
        //appData.source means template id
        return portal.getItemData(appData.source).then(function(templateData){
          return {
            appData: appData,
            templateData: templateData
          };
        });
      });
    },

    _getWabAppIdAndDataFromTemplateAppId: function(portalUrl, appId){
      //the appid means: the app created by AGOL template.
      var def = new Deferred();
      var portal = portalUtils.getPortal(portalUrl);
      portal.getItemData(appId).then(lang.hitch(this, function(appData) {
        //appData.source means template id
        portal.getItemById(appData.source).then(lang.hitch(this, function(item) {
          var urlObject = esriUrlUtils.urlToObject(item.url);
          def.resolve({
            appId: urlObject.query.id,
            appData: appData
          });
        }));
      }), function(err){
        def.reject(err);
      });
      return def;
    },

    _getAppConfigFromAppId: function(portalUrl, appId){
      //the appid means: the app created by app builder.
      return portalUtils.getPortal(portalUrl).getItemData(appId);
    },

    _removeHash: function(urlParams){
      for(var p in urlParams){
        if(urlParams[p]){
          urlParams[p] = urlParams[p].replace('#', '');
        }
      }
    },

    loadWidgetsManifest: function(config){
      var defs = [], def = new Deferred();
      if(this.urlParams.manifest && config._buildInfo && config._buildInfo.widgetManifestsMerged){
        delete config._buildInfo.widgetManifestsMerged;
      }
      if(config._buildInfo && config._buildInfo.widgetManifestsMerged){
        this._loadMergedWidgetManifests().then(lang.hitch(this, function(manifests){
          sharedUtils.visitElement(config, lang.hitch(this, function(e){
            if(!e.widgets && (e.uri || e.itemId)){
              if(e.uri && manifests[e.uri]){
                this._addNeedValuesForManifest(manifests[e.uri], e.uri);
                jimuUtils.widgetJson.addManifest2WidgetJson(e, manifests[e.uri]);
              }else{
                defs.push(loadWidgetManifest(this.widgetManager, e));
              }
            }
          }));
          all(defs).then(function(){
            def.resolve(config);
          });
        }));
      }else{
        sharedUtils.visitElement(config, lang.hitch(this, function(e){
          if(!e.widgets && (e.uri || e.itemId)){
            defs.push(loadWidgetManifest(this.widgetManager, e));
          }
        }));
        all(defs).then(function(){
          def.resolve(config);
        });
      }

      function loadWidgetManifest(widgetManager, e){
        return widgetManager.loadWidgetManifest(e).then(function(manifest){
          return manifest;
        }, function(err){
          console.log('Widget failed to load, it is removed.', e.name);

          if(err.stack){
            console.error(err.stack);
          }else{
            //TODO err.code === 400, err.code === 403
            console.log(err);
          }
          deleteUnloadedWidgets(config, e);
        });
      }

      function deleteUnloadedWidgets(config, e){
        //if has e, delete a specific widget
        //if has no e, delete all unloaded widget
        deleteInSection('widgetOnScreen');
        deleteInSection('widgetPool');

        function deleteInSection(section){
          if(config[section] && config[section].widgets){
            config[section].widgets = config[section].widgets.filter(function(w){
              if(e){
                return w.id !== e.id;
              }else{
                if(w.uri && !w.manifest){
                  console.error('Widget is removed because it is not loaded successfully.', w.uri);
                }
                return w.manifest;
              }
            });
          }
          if(config[section] && config[section].groups){
            config[section].groups.forEach(function(g){
              if(g.widgets){
                g.widgets = g.widgets.filter(function(w){
                  if(e){
                    return w.id !== e.id;
                  }else{
                    if(w.uri && !w.manifest){
                      console.error('Widget is removed because it is not loaded successfully.', w.uri);
                    }
                    return w.manifest;
                  }
                });
              }
            });
          }
        }
      }

      setTimeout(function(){
        //delete problem widgets to avoid one widget crash app
        if(!def.isResolved()){
          deleteUnloadedWidgets(config);
          def.resolve(config);
        }
      }, 60 * 1000);
      return def;
    },

    _addNeedValuesForManifest: function(manifest, uri){
      lang.mixin(manifest, jimuUtils.getUriInfo(uri));

      jimuUtils.manifest.addManifestProperies(manifest);
      jimuUtils.manifest.processManifestLabel(manifest, dojoConfig.locale);
    },

    _loadMergedWidgetManifests: function(){
      var file = window.appInfo.appPath + 'widgets/widgets-manifest.json';
      return xhr(file, {
        handleAs: 'json'
      });
    },

    _fixRepeatedId: function(appConfig){
      var id = [];
      sharedUtils.visitElement(appConfig, function(e){
        if(id.indexOf(e.id) >= 0){
          e.id += '_';
        }
        id.push(e.id);
      });
    },

    //we use URL parameters for the first loading.
    //After loaded, if user changes app config through builder,
    //we'll use the configuration in builder.
    _processUrlParams: function(appConfig){
      var urlWebmap = this.urlParams.itemid || this.urlParams.webmap;
      if(urlWebmap && appConfig.map.itemId !== urlWebmap){
        if(appConfig.map.mapOptions){
          jimuUtils.deleteMapOptions(appConfig.map.mapOptions);
        }
        appConfig.map.itemId = urlWebmap;
      }
      if(this.urlParams.mode){
        appConfig.mode = this.urlParams.mode;
      }
      if(!appConfig.map.mapOptions){
        appConfig.map.mapOptions = {};
      }

      if(this.urlParams.scale){
        appConfig.map.mapOptions.scale = this.urlParams.scale;
      }
      if(this.urlParams.level || this.urlParams.zoom){
        appConfig.map.mapOptions.zoom = this.urlParams.level || this.urlParams.zoom;
      }
    }
  });

  clazz.getInstance = function (urlParams, options) {
    if(instance === null) {
      instance = new clazz(urlParams, options);
    }else{
      instance.urlParams = urlParams || {};
      instance.options = options;
    }
    return instance;
  };

  return clazz;
});
