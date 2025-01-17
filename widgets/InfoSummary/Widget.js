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
/*jshint loopfunc: true */
define(['jimu/BaseWidget',
'jimu/LayerInfos/LayerInfos',
'jimu/utils',
'dojo/dom',
'dojo/dom-class',
'dojo/dom-construct',
'dojo/on',
'dojo/dom-style',
'dojo/_base/declare',
'dojo/_base/lang',
'dojo/_base/html',
'dojo/_base/Color',
'dojo/promise/all',
'dojo/_base/array',
'dojo/DeferredList',
'dojo/Deferred',
'dojo/query',
"dojox/gfx/fx",
'dojox/gfx',
'dojo/_base/xhr',
"dojo/keys",
"dojo/dom-attr",
'dijit/focus',
'dijit/_WidgetsInTemplateMixin',
'esri/graphic',
'esri/geometry/Point',
'esri/symbols/SimpleMarkerSymbol',
'esri/symbols/PictureMarkerSymbol',
'esri/symbols/SimpleLineSymbol',
'esri/symbols/SimpleFillSymbol',
'esri/Color',
'esri/tasks/query',
'esri/tasks/QueryTask',
"esri/tasks/FeatureSet",
"esri/arcgis/utils",
'esri/symbols/jsonUtils',
'esri/request',
"esri/renderers/SimpleRenderer",
"esri/renderers/jsonUtils",
'./js/ClusterLayer',
'esri/layers/LayerDrawingOptions'
],
function (BaseWidget,
  LayerInfos,
  utils,
  dom,
  domClass,
  domConstruct,
  on,
  domStyle,
  declare,
  lang,
  html,
  dojoColor,
  all,
  array,
  DeferredList,
  Deferred,
  query,
  fx,
  gfx,
  xhr,
  keys,
  domAttr,
  focusUtil,
  _WidgetsInTemplateMixin,
  Graphic,
  Point,
  SimpleMarkerSymbol,
  PictureMarkerSymbol,
  SimpleLineSymbol,
  SimpleFillSymbol,
  Color,
  Query,
  QueryTask,
  FeatureSet,
  arcgisUtils,
  jsonUtils,
  esriRequest,
  SimpleRenderer,
  jsonUtil,
  ClusterLayer,
  LayerDrawingOptions
  ) {
  return declare([BaseWidget, _WidgetsInTemplateMixin], {
    baseClass: 'jimu-widget-InfoSummary',

    name: "InfoSummary",
    opLayerInfos: null,
    layerList: {},
    UNIQUE_APPEND_VAL_CL: "_CL",
    widgetChange: false,
    refreshInterval: 0,
    refreshIntervalValue: 0,
    configLayerInfos: [],
    legendNodes: [],
    currentQueryList: [],
    symbols: [],
    row: null,
    clusterLayerArray: [],
    initialOpen: true,
    isOpen: false,
    staticLayers: ["CSV", "CSVLayer", "Feature Collection", "GeoRSS", "KML"],

    postCreate: function () {
      this.inherited(arguments);
      this.inPanelOverrides(this.appConfig.theme.name);
      this.configLayerInfos = this.config.layerInfos;
      this.layerList = {};
      //populates this.layerInfos and creates the panel
      this._initWidget();
    },

    _forceClose: function () {
      var themeName = this.appConfig.theme.name;
      var dcThemes = ['LaunchpadTheme', 'DartTheme', 'FoldableTheme',
        'JewelryBoxTheme', 'BillboardTheme', 'TabTheme', 'DashboardTheme', 'PocketTheme'];
      var p = this.getPanel();
      if (dcThemes.indexOf(themeName) > -1) {
        p.containerNode.parentNode.style.display = 'none';
        p.containerNode.style.display = 'none';
        this.widgetManager.closeWidget(this.id);
      } else if (themeName === 'BoxTheme') {
        p.containerNode.parentNode.style.display = 'none';
        p.containerNode.style.display = 'none';
        if (p.getParent && p.getParent()._toggleBox) {
          var ss = query('.icon-node-active');
          for (var i = 0; i < ss.length; i++) {
            if (ss[i].outerHTML.indexOf(this.id) > -1) {
              p.getParent()._toggleBox();
            }
          }
        }
      } else if (themeName === 'PlateauTheme') {
        p.containerNode.parentNode.style.display = 'none';
        p.containerNode.style.display = 'none';
        this.widgetManager.closeWidget(this.id);
        if (!this.aw) {
          var widgets = this.widgetManager.appConfig.widgetOnScreen.widgets;
          for (var ii = 0; ii < this.widgetManager.appConfig.widgetOnScreen.widgets.length; ii++) {
            if (widgets[ii].isThemeWidget) {
              this.aw = this.widgetManager.getWidgetById(widgets[ii].id);
              this.aw._switchNodeToClose(this.id);
              this.aw._closeDropMenu();
              break;
            }
          }
        } else {
          this.aw._switchNodeToClose(this.id);
          this.aw._closeDropMenu();
        }
      }
    },

    inPanelOverrides: function (themeName) {
      if (typeof (this.iconClickHandler) !== 'undefined') {
        this.iconClickHandler.remove();
        this.iconClickHandler = undefined;
      }

      var p = this.getPanel();

      if (this.config.hidePanel) {
        var iconNodeThemes = ['DartTheme', 'BoxTheme', 'FoldableTheme', 'JewelryBoxTheme', 'PlateauTheme'];

        var iconNodes;
        if (themeName === 'LaunchpadTheme' || themeName === 'PocketTheme') {
          this._forceClose();
          iconNodes = query('.selected');
          if (iconNodes.length > 0) {
            if (iconNodes[0].parentNode.outerHTML.indexOf(this.id) > -1) {
              this.iconClickHandler = on(iconNodes[0], 'click', lang.hitch(this, this._forceClose));
            }
          }
        } else if (iconNodeThemes.indexOf(themeName) > -1) {
          if (themeName === 'BoxTheme') {
            this._forceClose(); //did this for box...make sure it doesn't jack others up
          }
          iconNodes = query('.icon-node');
          for (var i = 0; i < iconNodes.length; i++) {
            if (iconNodes[i].outerHTML.indexOf(this.id) > -1) {
              this.iconClickHandler = on(iconNodes[i], 'click', lang.hitch(this, this._forceClose));
            }
          }
        }
      } else {
        //TODO test if this has the class .jimu-widget-frame.jimu-container
        if (p.containerNode && p.containerNode.firstChild && p.containerNode.firstChild.className) {
          p.containerNode.firstChild.style.padding = '0px 0px 10px 0px';
        }

        //change associated with the tab theme...all others will show the background color behind refresh text and panel image
        if (['TabTheme', 'BillboardTheme', 'PlateauTheme', 'DashboardTheme'].indexOf(themeName) === -1) {
          this._updateBackgroundColors(true);
        }

        this.isDartTheme = themeName === "DartTheme";
        this.isDashboardTheme = themeName === 'DashboardTheme';
        if (domClass.contains(this.pageHeader, this.isDartTheme ? 'pageHeader-border' : 'pageHeader-border-dart')) {
          domClass.remove(this.pageHeader, this.isDartTheme ? 'pageHeader-border' : 'pageHeader-border-dart');
        }
        domClass.add(this.pageHeader, this.isDartTheme ? 'pageHeader-border-dart' : 'pageHeader-border');

        switch (themeName) {
          case 'DartTheme':
            this.updateForDartTheme(p);
            break;
          case 'BoxTheme':
            this.updateForBoxTheme(p);
            break;
          case 'TabTheme':
            this.updateForTabTheme(p);
            break;
          case 'LaunchpadTheme':
            this.updateForLaunchpadTheme(p);
            break;
          case 'BillboardTheme':
            this.updateForBillboardTheme(p);
            break;
          case 'PlateauTheme':
            this.updateForPlateauTheme(p);
            break;
          case 'DashboardTheme':
            this.updateForDashboardTheme(p);
            break;
        }
      }
    },

    updateForLaunchpadTheme: function (p) {
      p.containerNode.style.top = '30px';
    },

    updateForTabTheme: function (p) {
      if (p.containerNode.children.length > 0) {
        var fc = p.containerNode.children[0];
        if (fc.children.length > 1) {
          fc.children[1].style.padding = '14px 0px 14px 0px';
        }
      }
      if (!p.config.isOnScreen) {
        this._updateBackgroundColors(false);
      }
    },

    updateForBoxTheme: function (p) {
      p.containerNode.parentNode.style.top = '140px';
    },

    updateForDartTheme: function (p) {
      p.containerNode.style.right = '0px';
      p.containerNode.style.left = '0px';
    },

    updateForBillboardTheme: function () {
      this._updateBackgroundColors(false);
    },

    updateForPlateauTheme: function () {
      this._updateBackgroundColors(false);
    },

    updateForDashboardTheme: function () {
      this._updateBackgroundColors(false);
    },

    _updateBackgroundColors: function (add) {
      //deal with text color
      if (domClass.contains(this.lastUpdated, add ? 'lastUpdated-tab' : 'lastUpdated')) {
        domClass.remove(this.lastUpdated, add ? 'lastUpdated-tab' : 'lastUpdated');
      }
      domClass.add(this.lastUpdated, add ? 'lastUpdated' : 'lastUpdated-tab');

      add = add && this.appConfig.theme.name !== 'DashboardTheme';
      this.useDarkText = !add;

      //deal with background color for page header
      if (domClass.contains(this.pageHeader, 'jimu-main-background') && !add) {
        domClass.remove(this.pageHeader, 'jimu-main-background');
      } else if (!domClass.contains(this.pageHeader, 'jimu-main-background') && add) {
        domClass.add(this.pageHeader, 'jimu-main-background');
      }
      if (domClass.contains(this.pageHeader, 'dart-bgcolor') && !add) {
        domClass.remove(this.pageHeader, 'dart-bgcolor');
      } else if (!domClass.contains(this.pageHeader, 'dart-bgcolor') && add) {
        domClass.add(this.pageHeader, 'dart-bgcolor');
      }
      if (domClass.contains(this.pageHeader, 'box-bgcolor') && !add) {
        domClass.remove(this.pageHeader, 'box-bgcolor');
      } else if (!domClass.contains(this.pageHeader, 'box-bgcolor') && add) {
        domClass.add(this.pageHeader, 'box-bgcolor');
      }
    },

    startup: function () {
      this.inherited(arguments);
    },

    onOpen: function () {
      this.widgetChange = false;
      this.isOpen = true;

      if (!this.hidePanel) {
        this._updatePanelHeader();
      } else {
        if (this.appConfig.theme.name !== 'BoxTheme') {
          this._forceClose();
        }
      }
      if (this.appConfig.theme.styles && this.appConfig.theme.styles[0]) {
        this._updateStyleColor(this.appConfig.theme.styles[0]);
      }

      if (!this.hidePanel) {
        this._setVisibleSubLayers();
      }

      if (!this.hidePanel && !this.showAllFeatures) {
        if (typeof (this.mapExtentChangedHandler) === 'undefined') {
          this.mapExtentChangedHandler = this.map.on("extent-change", lang.hitch(this, this._mapExtentChange));
        }
      }

      //if refresh is enabled set refereshInterval on any widget source layers with refresh set to true
      //and call setInterval to refresh the static graphics
      if (this.config.refreshEnabled) {
        this.enableRefresh();
      }

      if (this.map.infoWindow) {
        this.map.infoWindow.highlight = true;
      }

      if(this.clusterLayerArray.length) {
        this.clusterLayerArray.forEach(lang.hitch(this, function(clusterLayerObj) {
          clusterLayerObj.clusterLayer.show();
        }));
      }
      if (!this.config.expandList) {
        this.initialOpen = false;
      }
    },

    _updateRenderer: function (layerInfo, layerObject) {
      if (layerInfo && layerInfo.orgRenderer) {
        if (layerObject.setLayerDrawingOptions && !isNaN(layerInfo.subLayerId)) {
          var optionsArray = [];
          var drawingOptions = new LayerDrawingOptions();
          drawingOptions.renderer = layerInfo.newRenderer;
          optionsArray[layerInfo.subLayerId] = drawingOptions;
          layerObject.setLayerDrawingOptions(optionsArray);
        } else if (layerObject.setRenderer) {
          layerObject.setRenderer(layerInfo.newRenderer);
        } else {
          console.log("Error setting the new renderer...will use the default rendering of the layer");
        }
        if (typeof (layerObject.refresh) === 'function') {
          layerObject.refresh();
        }
      }
    },

    _getParentLayer: function(layerInfo, layerObject) {
      var parentLayer;
      if (layerObject && layerObject.layerInfos) {
        parentLayer = layerObject;
      } else if (layerInfo && typeof (layerInfo.parentLayerID) !== 'undefined') {
        parentLayer = this.map.getLayer(layerInfo.parentLayerID);
      }
      return parentLayer;
    },

    _setVisibleSubLayers: function () {
      var visibleSubLayers = [];
      for (var key in this.layerList) {
        var layerListLayer = this.layerList[key];
        var li = layerListLayer.li;
        var lo = layerListLayer.layerObject;
        this._updateRenderer(li, lo);
        var _Pl = this._getParentLayer(li, lo);

        var l;
        if (_Pl && _Pl.visibleLayers) {
          var _foundIt = false;
          sub_layers_id_loop:
          for (var ii = 0; ii < visibleSubLayers.length; ii++) {
            var subVizLyrId = visibleSubLayers[ii].id;
            if (subVizLyrId === _Pl.id) {
              _foundIt = true;
              break sub_layers_id_loop;
            }
          }
          if (visibleSubLayers.length === 0 || !_foundIt) {
            visibleSubLayers.push({
              id: _Pl.id,
              layers: _Pl.visibleLayers
            });
          }
          var x = 0;
          subLayerLoop:
          for (x; x < visibleSubLayers.length; x++) {
            var o = visibleSubLayers[x];
            if (o.id === _Pl.id) {
              break subLayerLoop;
            }
          }
          var visLayers = visibleSubLayers[x].layers;
          if (_Pl.layerInfos) {
            //Handle MapService layers
            if (_Pl.layerInfos.length > 0) {
              if (li && typeof (li.subLayerId) !== 'undefined') {
                var inVisLayers = visLayers.indexOf(li.subLayerId) > -1;
                var plVis = layerListLayer.parentLayerVisible;
                var loPlVis = layerListLayer.layerObject.parentLayerVisible;
                if (layerListLayer.type === "ClusterLayer" && (inVisLayers || plVis || loPlVis)) {
                  layerListLayer.parentLayerVisible = true;
                  layerListLayer.layerObject.parentLayerVisible = true;
                  layerListLayer.visible = true;
                  if (inVisLayers) {
                    visLayers.splice(visLayers.indexOf(li.subLayerId), 1);
                  }
                } else if (inVisLayers || plVis) {
                  layerListLayer.parentLayerVisible = true;
                  layerListLayer.visible = true;
                  if (visLayers.indexOf(li.subLayerId) === -1) {
                    visLayers.push(li.subLayerId);
                  }
                }else {
                  layerListLayer.parentLayerVisible = false;
                  layerListLayer.visible = false;
                  if (inVisLayers) {
                    visLayers.splice(visLayers.indexOf(li.subLayerId), 1);
                  }
                  if (layerListLayer.type === "ClusterLayer") {
                    layerListLayer.layerObject.parentLayerVisible = false;
                    if (this.map.graphicsLayerIds.indexOf(layerListLayer.id) > -1) {
                      l = this.map.getLayer(layerListLayer.id);
                      l.setVisibility(false);
                    }
                  }
                }
              }
            }
            visibleSubLayers[x].layers = visLayers;
          }
          this.updatePanelVisibility(layerListLayer, key, layerListLayer);
        } else if (lo) {
          //Handle non MapService layers
          if (layerListLayer.type === "ClusterLayer") {
            if (lo._parentLayer) {
              if (this.map.graphicsLayerIds.indexOf(layerListLayer.id) > -1) {
                l = this.map.getLayer(layerListLayer.id);
                if (typeof (layerListLayer.layerObject.parentLayerVisible) === 'undefined') {
                  layerListLayer.parentLayerVisible = lo._parentLayer.visible;
                  layerListLayer.layerObject.parentLayerVisible = lo._parentLayer.visible;
                }
                l.setVisibility(layerListLayer.layerObject.parentLayerVisible);
              }
              if (lo._parentLayer.setVisibility) {
                lo._parentLayer.setVisibility(false);
              }
            }
          }
          this.updatePanelVisibility(lo, key, layerListLayer);
        }

        if (this.showAllFeatures && this.config.expandList && layerListLayer.legendOpen && !layerListLayer.isLoaded) {
          var visScaleRange = layerListLayer.visScaleRange;
          if(typeof(visScaleRange) !== 'undefined'){
            visScaleRange = this._inVisibleRange(key);
          }
          if (layerListLayer.visible && visScaleRange) {
            layerListLayer.updateList = true;
          }
        }
      }
      for (var i = 0; i < visibleSubLayers.length; i++) {
        var parentLayer = this.map.getLayer(visibleSubLayers[i].id);
        if (parentLayer) {
          parentLayer.setVisibleLayers(visibleSubLayers[i].layers);
        }
      }
      if(this.initialOpen) {
        this.openAtStartAysn = true;
      }
      this._support508Accessibility(!utils.isAutoFocusFirstNodeWidget(this));
    },

    updatePanelVisibility: function (lo, key, layerListLayer) {
      if (!this.hidePanel) {
        if (typeof (lo.visible) !== 'undefined') {
          var visScaleRange = layerListLayer.visScaleRange;
          var c = dom.byId("recLabel_" + key);
          var recInActive;
          var rec = dom.byId("rec_" + key);
          var recIcon = dom.byId("recIcon_" + key);
          var exp = dom.byId("exp_" + key);
          var recNum = dom.byId("recNum_" + key);
          if (rec) {
            recInActive = domClass.contains("rec_" + key, 'inActive');
          }
          if (!lo.visible) {
            if (recIcon && domClass.contains("recIcon_" + key, "active")) {
              domClass.remove("recIcon_" + key, "active");
              if (!recInActive) {
                domClass.remove("recIcon_" + key, 'sub-active');
              }
            }
            if (this.config.countEnabled) {
              if (recNum && domClass.contains("recNum_" + key, "recNum")) {
                domClass.remove("recNum_" + key, "recNum");
                domClass.add("recNum_" + key, "recNumInActive");
              }
            }
            if (c && c.firstChild && !recInActive) {
              domClass.add(c.firstChild, "inActive");
            }
            if (!layerListLayer.listDisabled) {
              if (exp && !domClass.contains("exp_" + key, "expandInActive")) {
                domClass.add("exp_" + key, "expandInActive");
              }
              layerListLayer.toggleLegend.remove();
            }
            if (rec && domClass.contains("rec_" + key, "rec")) {
              domClass.add("rec_" + key, "recDefault");
            }
          } else {
            if (recIcon && !domClass.contains("recIcon_" + key, "active")) {
              domClass.add("recIcon_" + key, "active");
              if (!recInActive) {
                domClass.add("recIcon_" + key, 'sub-active');
              }
            }
            if (this.config.countEnabled) {
              if (recNum && domClass.contains("recNum_" + key, "recNumInActive")) {
                domClass.remove("recNum_" + key, "recNumInActive");
                domClass.add("recNum_" + key, "recNum");
              }
            }
            if (c && c.firstChild && !recInActive) {
              domClass.remove(c.firstChild, "inActive");
            }
            if (!layerListLayer.listDisabled) {
              if (typeof(visScaleRange) === 'undefined' || visScaleRange) {
                if (exp && domClass.contains("exp_" + key, "expandInActive")) {
                  domClass.remove("exp_" + key, "expandInActive");
                }
              }
            }
            if (rec && domClass.contains("rec_" + key, "recDefault")) {
              domClass.remove("rec_" + key, "recDefault");
            }
          }
        }
      }
      if (this.initialOpen) {
        this.openAtStartAysn = true;
      }
      this._support508Accessibility(!utils.isAutoFocusFirstNodeWidget(this));
    },

    enableRefresh: function () {
      //set refreshItereval on all widget source layers that support it
      var layerListLayer = null;
      var refreshLayers = [];
      for (var key in this.layerList) {
        var id;
        layerListLayer = this.layerList[key];
        if (layerListLayer.li) {
          id = layerListLayer.li.itemId;
        }
        if (layerListLayer.type !== "ClusterLayer") {
          layerListLayer = layerListLayer.layerObject;
        } else {
          for (var i = 0; i < this.layerInfos.length; i++) {
            var l = this.layerInfos[i];
            if (l.layerObject) {
              layerListLayer = l.layerObject;
              break;
            }
          }
        }
        if (id && refreshLayers.indexOf(id) === -1) {
          refreshLayers.push(id);
        }
        if (layerListLayer) {
          layerListLayer.refreshInterval = this.config.refreshInterval;
        }
      }
      if (refreshLayers.length > 0) {
        this.refreshLayers();
      }

      var tempVal = this.config.refreshInterval * 60000;
      if (this.refreshInterval === 0 && this.refreshIntervalValue === 0) {
        //set the refresh interval based on the configs interval value
        this.refreshIntervalValue = tempVal;
        this.refreshInterval = setInterval(lang.hitch(this, this.refreshLayers), (this.refreshIntervalValue));
      } else if (this.refreshIntervalValue !== 0 && (this.refreshIntervalValue !== tempVal)) {
        //clear and update the refresh interval if the configs refresh interval has changed
        this.refreshIntervalValue = tempVal;
        clearInterval(this.refreshInterval);
        this.refreshInterval = 0;
        this.refreshInterval = setInterval(lang.hitch(this, this.refreshLayers), (this.refreshIntervalValue));
      }
    },

    getItem: function (id) {
      var def = new Deferred();
      var portalUrl = window.portalUrl.substr(-1) !== '/' ? window.portalUrl += '/' : window.portalUrl;
      var url = portalUrl + "sharing/rest/content/items/" + id;
      esriRequest({
        url: url,
        content: {
          f: "json",
          requestTime: Date.now()
        }
      }).then(lang.hitch(this, function (response) {
        def.resolve({
          response: response,
          url: url
        });
      }));
      return def;
    },

    _updatePanelTime: function (modifiedTime) {
      if (!this.hidePanel) {
        this.lastUpdated.innerHTML = "<div></div>";
        var _d = new Date(modifiedTime);
        var _f = { dateFormat: 'shortDateShortTime' };
        this.lastUpdated.innerHTML = utils.fieldFormatter.getFormattedDate(_d, _f);
      }
    },

    refreshLayers: function () {
      var itemRequests = [];
      for (var key in this.layerList) {
        var lyr = this.layerList[key];
        var id;
        if (lyr.li && lyr.li.itemId) {
          id = lyr.li.itemId;
        } else if (lyr.layerObject.itemId) {
          id = lyr.layerObject.itemId;
        }

        //only query each id once if item has a grouped layer
        if (id) {
          if (this.currentQueryList.indexOf(id) === -1) {
            this.currentQueryList.push(id);
            itemRequests.push(this.getItem(id));
          }
        }
      }
      if (itemRequests.length > 0) {
        var updateResponses = [];
        var itemList = new DeferredList(itemRequests);
        itemList.then(lang.hitch(this, function (items) {
          this.currentQueryList = [];
          if (items) {
            for (var i = 0; i < items.length; i++) {
              var item = items[i][1];
              var response = item.response;
              if (response) {
                var update = this._shouldUpdate(response);
                if (update) {
                  updateResponses.push({
                    response: response,
                    id: response.id,
                    url: item.url
                  });
                }
              }
            }

            if (updateResponses.length > 0) {
              this._updateItems(updateResponses);
            }
          }
        }));
      }
    },

    _updateItems: function (updateResponses) {
      var itemDataRequests = [];
      var itemIDs = [];
      updateResponses.forEach(lang.hitch(this, function (updateResponse) {
        itemIDs.push(updateResponse.id);
        itemDataRequests.push(this._getItemData(updateResponse.response, updateResponse.url));
      }));

      var itemDataList = new DeferredList(itemDataRequests);
      itemDataList.then(lang.hitch(this, function (itemDataResponses) {
        for (var i = 0; i < itemDataResponses.length; i++) {
          this._updateItem(itemDataResponses[i][1]);
        }
      }));
    },

    _shouldUpdate: function (response) {
      var itemModified = response.modified;
      var update = true;
      if (this.lastModifiedTime) {
        update = this.lastModifiedTime < itemModified;
      }
      return update;
    },

    _getItemData: function (response, url) {
      if (response) {
        var itemModified = response.modified;
        var nulls = [null, undefined];
        this.lastModifiedTime = (this.lastModifiedTime < itemModified) || nulls.indexOf(this.lastModifiedTime) !== -1 ?
          itemModified : this.lastModifiedTime;
        this._updatePanelTime(itemModified);
        return esriRequest({
          url: url + '/data',
          content: {
            f: "json",
            requestTime: Date.now()
          }
        });
      }
    },

    _updateItem: function (response) {
      var featureCollection = response;
      for (var i = 0; i < featureCollection.layers.length; i++) {
        this._updateLayerItem(featureCollection.layers[i], this.lastModifiedTime);
      }
    },

    //TDOO ensure this functions as expected when filter by map extent id disabled
    _updateLayerItem: function (responseLayer) {
      var layerListLayer;
      var parentLayer;
      var list, fields;
      for (var k in this.layerList) {
        var lyr = this.layerList[k];
        if (lyr.pl && lyr.pl.layerDefinition) {
          if (lyr.pl.layerDefinition.name === responseLayer.layerDefinition.name) {
            layerListLayer = lyr;
            parentLayer = lyr.pl;
            break;
          }
        } else if (lyr.layerObject._parentLayer) {
          if (lyr.layerObject._parentLayer.name === responseLayer.layerDefinition.name ||
            (lyr.layerDefinition && lyr.layerDefinition.name === responseLayer.layerDefinition.name)) {
            list = typeof (lyr.listDisabled) !== 'undefined' ? lyr.listDisabled : false;
            fields = lyr.li.symbolData.featureDisplayOptions.fields &&
              lyr.li.symbolData.featureDisplayOptions.fields.length > 0;
            if (!list && fields) {
              lyr.isLoaded = false;
            }
            lyr.layerObject.refreshFeatures(responseLayer);
            if (lyr.layerObject) {
              this._loadList(lyr, true);
            }
          }
        } else if (lyr.layerDefinition && lyr.pl) {
          if (lyr.layerDefinition.name === responseLayer.layerDefinition.name) {
            layerListLayer = lyr;
            parentLayer = lyr.pl;
            break;
          }
        } else if (lyr.pl && lyr.pl.name) {
          if (lyr.pl.name === responseLayer.layerDefinition.name) {
            layerListLayer = lyr;
            parentLayer = lyr.pl;
            break;
          }
        }
      }

      if (responseLayer && layerListLayer && parentLayer && (parentLayer.featureSet || parentLayer.graphics)) {
        var responseFeatureSetFeatures = responseLayer.featureSet.features;

        var mapFeatureSetFeatures;
        if (parentLayer.featureSet) {
          mapFeatureSetFeatures = parentLayer.featureSet.features;
        } else {
          mapFeatureSetFeatures = [];
          var responseSR = this._getSpatialReference(responseFeatureSetFeatures);
          var mapSR = this._getSpatialReference(parentLayer.graphics);
          array.forEach(parentLayer.graphics, function (gra) {
            var g = gra.geometry;
            var geom = g.rings ? { rings: g.rings } : g.paths ? { paths: g.paths } :
              g.points ? { points: g.points } : (g.x && g.y) ? { x: g.x, y: g.y } : {};
            if (geom !== {}) {
              mapFeatureSetFeatures.push({
                attributes: gra.attributes,
                geometry: lang.mixin({
                  spatialReference: (responseSR && mapSR && responseSR.wkid === mapSR.wkid) ? responseSR : mapSR
                }, geom)
              });
            }
          });
        }

        if (responseLayer.featureSet.transform) {
          var fs = new FeatureSet(responseLayer.featureSet);
          responseFeatureSetFeatures = fs.features;
        }

        var shouldUpdate = true;
        //TODO Figure out a better test for larger responses
        if (responseFeatureSetFeatures.length < 10000) {
          shouldUpdate = JSON.stringify(mapFeatureSetFeatures) !== JSON.stringify(responseFeatureSetFeatures);
        }

        if (shouldUpdate) {
          list = typeof (layerListLayer.listDisabled) !== 'undefined' ? layerListLayer.listDisabled : false;
          fields = layerListLayer.li.symbolData.featureDisplayOptions.fields &&
            layerListLayer.li.symbolData.featureDisplayOptions.fields.length > 0;
          if (!list && fields) {
            layerListLayer.isLoaded = false;
            layerListLayer.requiresReload = true;
          }
          if (list) {
            layerListLayer.li.layerListExtentChanged = true;
          }
          layerListLayer.layerObject.clear();
          var sr = layerListLayer.layerObject.spatialReference;
          for (var j = 0; j < responseFeatureSetFeatures.length; j++) {
            var item = responseFeatureSetFeatures[j];
            if (item.geometry) {
              //check li for renderer also
              var go = this.getGraphicOptions(item, sr);
              var gra = new Graphic(go);
              //removed for https://devtopia.esri.com/WebGIS/arcgis-webappbuilder/issues/11551
              //gra.setSymbol(go.symbol);
              gra.setAttributes(item.attributes);
              if (this._infoTemplate) {
                gra.setInfoTemplate(this._infoTemplate);
              }
              layerListLayer.layerObject.add(gra);
            } else {
              console.log("Null geometry skipped");
            }
          }
          layerListLayer.layerObject.refresh();
          if (parentLayer.featureSet) {
            parentLayer.featureSet.features = responseFeatureSetFeatures;
          }
          this.countFeatures(layerListLayer).then(lang.hitch(this, function (layerListLayer) {
            if (layerListLayer.layerObject && layerListLayer.layerObject.visible) {
              this._loadList(layerListLayer, true);
            }
          }));
        }
      }
    },

    _getSpatialReference: function (features) {
      var sr;
      if (features && features.hasOwnProperty('length') && features.length > 0) {
        var firstFeature = features[0];
        if (firstFeature.geometry && firstFeature.geometry.spatialReference) {
          sr = firstFeature.geometry.spatialReference;
        }
      }
      return sr;
    },

    getGraphicOptions: function (item, sr) {
      var graphicOptions;
      if (typeof (item.geometry.rings) !== 'undefined') {
        graphicOptions = {
          geometry: {
            rings: item.geometry.rings,
            "spatialReference": { "wkid": sr.wkid }
          }
        };
      } else if (typeof (item.geometry.paths) !== 'undefined') {
        graphicOptions = {
          geometry: {
            paths: item.geometry.paths,
            "spatialReference": { "wkid": sr.wkid }
          }
        };
      } else if (typeof (item.geometry.points) !== 'undefined') {
        graphicOptions = {
          geometry: {
            points: item.geometry.points,
            "spatialReference": { "wkid": sr.wkid }
          }
        };
      } else {
        graphicOptions = {
          geometry: new Point(item.geometry.x, item.geometry.y, item.geometry.spatialReference)
        };
      }
      return graphicOptions;
    },

    _initWidget: function () {
      this.hidePanel = typeof (this.config.hidePanel) !== 'undefined' ? this.config.hidePanel : false;
      this.showAllFeatures = typeof (this.config.showAllFeatures) !== 'undefined' ? this.config.showAllFeatures : false;
      if (this.map.itemId) {
        LayerInfos.getInstance(this.map, this.map.itemInfo)
          .then(lang.hitch(this, function (operLayerInfos) {
            this.wmLayerInfos = operLayerInfos.getLayerInfoArrayOfWebmap();
            this.layerInfos = operLayerInfos.getLayerInfoArray();
            this.operLayerInfos = operLayerInfos;
            this._updateLayerIDs();
            if (this.config.upgradeFields) {
              this._upgradeFields();
            }
            this._createPanelUI(this.configLayerInfos, operLayerInfos).then(lang.hitch(this, function(){
              this._addFilterChanged(operLayerInfos);
              this._addZoomChanged(operLayerInfos);
              this._setVisibleSubLayers();
              this._addVisibleChanged(operLayerInfos);
            }));
          }));
      }
    },

    _updateLayerIDs: function () {
      var removeIDs = [];

      //added to make sure the url we have uses the proxy url
      //issue: https://devtopia.esri.com/WebGIS/arcgis-webappbuilder/issues/11551
      var getUrl = function (configLayer, jimuLayerInfo) {
        return (jimuLayerInfo.layerObject && jimuLayerInfo.layerObject.url) ?
          jimuLayerInfo.layerObject.url : configLayer.url;
      };

      config_layer_loop:
      for (var i = 0; i < this.configLayerInfos.length; i++) {
        var configLayer = this.configLayerInfos[i];
        var jimuLayerInfo = this.operLayerInfos.getLayerInfoById(configLayer.id);

        //If we cannot find the jimu layer info based on the stored ID we need to determine it
        if (!jimuLayerInfo) {
          var updated = false;
          wm_layer_loop:
          for (var ii = 0; ii < this.wmLayerInfos.length; ii++) {
            var _opLayer = this.wmLayerInfos[ii];
            var originOpLayer = _opLayer ? _opLayer.originOperLayer : undefined;

            var urlId = this._compareURL(originOpLayer, configLayer);
            var itemId = this._compareItemID(originOpLayer, configLayer);
            var subId = this._compareSubId(_opLayer, configLayer);

            var id = urlId ? urlId : itemId ? itemId : subId ? subId : undefined;
            jimuLayerInfo = id ? this.operLayerInfos.getLayerInfoById(id) : jimuLayerInfo;

            if (jimuLayerInfo) {
              this.configLayerInfos[i].id = jimuLayerInfo.id;
              this.configLayerInfos[i].layer = jimuLayerInfo.id;
              this.configLayerInfos[i].url = getUrl(this.configLayerInfos[i], jimuLayerInfo);
              updated = true;
              break wm_layer_loop;
            }
          }

          if (!updated && !jimuLayerInfo) {
            removeIDs.push(i);
          }
        } else {
          configLayer.url = getUrl(configLayer, jimuLayerInfo);
        }
      }

      //This needs to occur largest to smallest
      if (removeIDs.length > 0) {
        //removeIDs.sort((a, b) => (b - a));
        removeIDs.sort(function (a, b) { return b - a; });
        array.forEach(removeIDs, lang.hitch(this, function (id) {
          this.configLayerInfos.splice(id, 1);
        }));
      }
    },

    _compareSubId: function (opLayer, configLayer) {
      if (opLayer && opLayer.subId && opLayer.subId.indexOf(configLayer.id) > -1) {
        if (opLayer.layerObject) {
          var geomMatch = this._compareGeom(opLayer.layerObject, configLayer);
          var fieldMatch = this._compareFields(opLayer.layerObject, configLayer);
          if (geomMatch && fieldMatch) {
            return opLayer.subId;
          }
        }
      }
      return undefined;
    },

    _compareItemID: function (originOpLayer, configLayer) {
      if (originOpLayer && originOpLayer.itemId && originOpLayer.itemId === configLayer.itemId) {
        if (originOpLayer.featureCollection && originOpLayer.featureCollection.layers &&
          originOpLayer.featureCollection.layers.hasOwnProperty('length')) {
          var fcLayers = originOpLayer.featureCollection.layers;
          for (var i = 0; i < fcLayers.length; i++) {
            var fcLayer = fcLayers[i];
            if (this._compareGeom(fcLayer, configLayer)){
              if (this._compareFields(fcLayer, configLayer)) {
                return fcLayer.id;
              }
            }
          }
          return undefined;
        } else {
          console.log('error in checking item by itemID');
        }
      }
    },

    _compareURL: function (originOpLayer, configLayer) {
      return (originOpLayer && originOpLayer.url && configLayer.url && originOpLayer.url === configLayer.url) ?
        originOpLayer.id : undefined;
    },

    _compareGeom: function (layerObject, configLayer) {
      return (layerObject && layerObject.geometryType && configLayer.geometryType) ?
        layerObject.geometryType === configLayer.geometryType : undefined;
    },

    _compareFields: function (layerObject, configLayer) {
      var fieldMatch;
      if (layerObject && layerObject.fields && configLayer.fields &&
        layerObject.fields.length === configLayer.fields.length) {
        //test if Names match
        var matchingFields = layerObject.fields.filter(function (f) {
          for (var fn = 0; fn < configLayer.fields.length; fn++) {
            var configField = configLayer.fields[fn];
            if (f.name === configField.name) {
              return f;
            }
          }
        });
        fieldMatch = matchingFields.length === layerObject.fields.length;
      }
      return fieldMatch;
    },

    //added for backwards compatability
    //could not handle directly in VersionManager as some stored layerInfos
    // do not have a valid infoTemplate saved
    _upgradeFields: function () {
      if (this.configLayerInfos) {
        for (var i = 0; i < this.configLayerInfos.length; i++) {
          var li = this.configLayerInfos[i];
          if (li && li.symbolData && li.symbolData.featureDisplayOptions) {
            var lyrInfo = this.operLayerInfos.getLayerInfoById(li.id);
            if (lyrInfo) {
              var fields = li.symbolData.featureDisplayOptions.fields;
              //At previous releases we would use the first field from the infoTemplate or
              //the first non-OID field from the layer if no fields were selected by the user
              if (typeof (fields) === 'undefined' || (fields.hasOwnProperty('length') && fields.length === 0)) {
                //check layer fields
                var layerObject = (lyrInfo && lyrInfo.layerObject) ? lyrInfo.layerObject : undefined;
                var oidFieldName = (layerObject && layerObject.objectIdField) ? layerObject.objectIdField : undefined;
                var firstLayerFieldName = "";
                var firstLayerFieldAlias = "";
                var layerFields = li.fields ? li.fields : layerObject ? layerObject.fields : undefined;
                if (layerFields && layerFields.length > 0) {
                  layer_field_loop:
                  for (var _i = 0; _i < layerFields.length; _i++) {
                    var f = layerFields[_i];
                    if (firstLayerFieldName === "" && f.type !== "esriFieldTypeOID" &&
                      f.type !== "esriFieldTypeGeometry" && f.name !== oidFieldName) {
                      firstLayerFieldName = f.name;
                      firstLayerFieldAlias = f.alias || f.name;
                    }
                    if (!oidFieldName) {
                      oidFieldName = f.type === "esriFieldTypeOID" ? f.name : oidFieldName;
                    }
                    if (oidFieldName && firstLayerFieldName !== "") {
                      break layer_field_loop;
                    }
                  }
                }

                //check popup fields
                var keyFieldName = "";
                var keyFieldAlias = "";
                var infoTemplate = li.infoTemplate && li.infoTemplate.info && li.infoTemplate.info.fieldInfos ?
                  li.infoTemplate : lyrInfo ? lyrInfo.getInfoTemplate() : undefined;
                if (!infoTemplate) {
                  var subLayers = lyrInfo.getSubLayers();
                  sub_layers_loop:
                  for (var sli = 0; sli < subLayers.length; sli++) {
                    var sl = subLayers[sli];
                    if (sl.title && sl.layerObject && sl.layerObject.name && sl.title === sl.layerObject.name) {
                      infoTemplate = sl.getInfoTemplate ? sl.getInfoTemplate() : infoTemplate;
                      break sub_layers_loop;
                    }
                  }
                }
                var popupFields = infoTemplate ? infoTemplate.info.fieldInfos : [];
                popup_field_loop:
                for (var j = 0; j < popupFields.length; j++) {
                  var popupField = popupFields[j];
                  if (popupField && popupField.visible) {
                    if (!oidFieldName || oidFieldName !== popupField.fieldName) {
                      keyFieldName = popupField.fieldName;
                      keyFieldAlias = popupField.label || popupField.fieldName;
                      break popup_field_loop;
                    }
                  }
                }

                //update the config
                this.configLayerInfos[i].symbolData.featureDisplayOptions.fields = [{
                  name: keyFieldName ? keyFieldName : firstLayerFieldName,
                  label: keyFieldName ? keyFieldAlias : firstLayerFieldAlias
                }];
              }
            }
          }
        }
      }
    },

    _addFilterChanged: function (layerInfos) {
      if (parseFloat(this.appConfig.wabVersion) >= 2.1) {
        this.own(layerInfos.on('layerInfosFilterChanged', lang.hitch(this, function (changedLayerInfoArray) {
          array.forEach(changedLayerInfoArray, lang.hitch(this, function (layerInfo) {
            var id = layerInfo.id;
            var clId = layerInfo.id + this.UNIQUE_APPEND_VAL_CL;
            var filter = layerInfo.getFilter();
            if (this.layerList.hasOwnProperty(id)) {
              this.layerList[id].isLoaded = this.layerList[id].filter === filter;
              this.layerList[id].filter = filter;
              this._loadList(this.layerList[id], true);
            } else if (this.layerList.hasOwnProperty(clId)) {
              this.layerList[clId].layerObject.filter = filter;
              this.layerList[clId].layerObject._initFeatures();
            }
          }));
        })));
      }
    },

    _updateVisibility: function (layerInfo) {
      if (layerInfo) {
        var id = layerInfo.id;
        var vis = layerInfo.isShowInMap();
        if (this.layerList.hasOwnProperty(id)) {
          var lyr = this.layerList[id];
          var _lyrInfo = id === lyr.li.id ? lyr.li : id === lyr.id ? layerInfo : undefined;
          if (_lyrInfo) {
            var inScaleRange = this._inVisibleRange(id);
            if (lyr.visible !== vis || lyr.visScaleRange !== inScaleRange) {
              this._toggleLayerUI(_lyrInfo, vis, inScaleRange);
            }
          }
        }
      }
    },

    _addVisibleChanged: function (layerInfos) {
      this.own(layerInfos.on('layerInfosIsVisibleChanged', lang.hitch(this, function (changedLayerInfos) {
        array.forEach(changedLayerInfos, function (layerInfo) {
          this._updateVisibility(layerInfo);
        }, this);
      })));
    },

    _addZoomChanged: function (layerInfos) {
      this.own(on(this.map, 'zoom-end', lang.hitch(this, function () {
        layerInfos.traversal(lang.hitch(this, function (layerInfo) {
          this._updateVisibility(layerInfo);
        }));
      })));
    },

    _updatePanelHeader: function () {
      var panelTitle;
      var w = this.map.width;
      if (this.config.displayPanelIcon && w > 750) {
        if (this.pageHeader) {
          html.removeClass(this.pageHeader, "pageHeaderNoIcon");
          html.removeClass(this.pageHeader, "pageHeaderNoIconRefresh");

          if (this.config.refreshEnabled) {
            if (this.config.mainPanelText !== "") {
              html.addClass(this.pageHeader, "pageHeaderRefresh");
            } else {
              html.addClass(this.pageHeader, "pageHeaderRefreshNoText");
            }
          } else {
            html.addClass(this.pageHeader, "pageHeader");
          }
        }

        if (this.pageBody) {
          html.removeClass(this.pageBody, "pageBodyNoIcon");
          html.removeClass(this.pageBody, "pageBodyNoIconRefresh");
          if (this.config.refreshEnabled) {
            if (this.config.mainPanelText !== "") {
              html.addClass(this.pageBody, "pageBodyRefresh");
            } else {
              html.addClass(this.pageBody, "pageBodyRefreshNoText");
            }
          } else {
            html.addClass(this.pageBody, "pageBody");
          }
        }

        if (this.pageTitle) {
          html.addClass(this.pageTitle, "pageTitleWidth");
          if (this.config.refreshEnabled) {
            html.removeClass(this.pageTitle, "pageTitle");
            html.removeClass(this.pageTitle, "pageTitleRefresh-tab");
            html.removeClass(this.pageTitle, "pageTitleRefresh");
            html.addClass(this.pageTitle, this.useDarkText ? "pageTitleRefresh-tab" : "pageTitleRefresh");
          } else {
            html.removeClass(this.pageTitle, "pageTitleRefresh");
            html.removeClass(this.pageTitle, "pageTitleRefresh-tab");
            html.addClass(this.pageTitle, "pageTitle");
          }
        }

        panelTitle = this.config.mainPanelText;
        if (typeof (panelTitle) === 'undefined') {
          panelTitle = "";
        }
        this.pageTitle.innerHTML = panelTitle;
        this.panelMainIcon.innerHTML = this.config.mainPanelIcon;
      } else if (!this.config.displayPanelIcon && !this.config.refreshEnabled) {
        if (this.pageHeader) {
          html.removeClass(this.pageHeader, "pageHeader");
          html.removeClass(this.pageHeader, "pageHeaderNoIconRefresh");
          html.addClass(this.pageHeader, "pageHeaderNoIcon");
        }

        if (this.pageBody) {
          html.removeClass(this.pageBody, "pageBody");
          html.removeClass(this.pageBody, "pageBodyNoIconRefresh");
          html.addClass(this.pageBody, "pageBodyNoIcon");
        }
        this.pageTitle.innerHTML = "<div></div>";
        this.panelMainIcon.innerHTML = "<div></div>";
      } else if (!this.config.displayPanelIcon && this.config.refreshEnabled) {
        if (this.pageHeader) {
          html.removeClass(this.pageHeader, "pageHeader");
          html.removeClass(this.pageHeader, "pageHeaderNoIcon");
          html.addClass(this.pageHeader, "pageHeaderNoIconRefresh");
        }

        if (this.pageBody) {
          html.removeClass(this.pageBody, "pageBody");
          html.removeClass(this.pageBody, "pageBodyNoIcon");
          html.addClass(this.pageBody, "pageBodyNoIconRefresh");
        }

        if (this.pageTitle) {
          html.removeClass(this.pageTitle, "pageTitleWidth");
        }
        this.pageTitle.innerHTML = "<div></div>";
        this.panelMainIcon.innerHTML = "<div></div>";
      } else if (this.config.displayPanelIcon && w <= 750 && this.config.refreshEnabled) {
        if (this.pageHeader) {
          html.removeClass(this.pageHeader, "pageHeaderNoIcon");
          html.removeClass(this.pageHeader, "pageHeaderNoIconRefresh");
          html.removeClass(this.pageHeader, "pageHeader");
          if (this.config.mainPanelText !== "") {
            html.addClass(this.pageHeader, "pageHeaderRefresh");
          } else {
            html.addClass(this.pageHeader, "pageHeaderRefreshNoText");
          }
        }

        if (this.pageBody) {
          html.removeClass(this.pageBody, "pageBodyNoIcon");
          html.removeClass(this.pageBody, "pageBodyNoIconRefresh");
          html.removeClass(this.pageBody, "pageBody");
          if (this.config.mainPanelText !== "") {
            html.addClass(this.pageBody, "pageBodyRefresh");
          } else {
            html.addClass(this.pageBody, "pageBodyRefreshNoText");
          }
        }

        if (this.pageTitle) {
          html.addClass(this.pageTitle, "pageTitleWidth");
        }

        panelTitle = this.config.mainPanelText;
        if (typeof (panelTitle) === 'undefined') {
          panelTitle = "";
        }
        this.pageTitle.innerHTML = panelTitle;
      }
    },

    _createPanelUI: function (configLayerInfos, jimuLayerInfos) {
      var def = new Deferred();
      this.numClusterLayers = 0;

      if (!this.hidePanel) {
        this._updatePanelHeader();
        this._updateUI(null);
        this._clearChildNodes(this.pageMain);
        this.updateEnd = [];
      }

      var _layerDetails = [];
      var _queries = [];

      for (var i = 0; i < configLayerInfos.length; i++) {
        var lyrInfo = configLayerInfos[i];
        if (lyrInfo.symbolData.clusterType === 'ThemeCluster') {
          this.updateThemeClusterSymbol(lyrInfo, i);
        }

        var jimuLayerInfo = jimuLayerInfos.getLayerInfoById(lyrInfo.id);
        if (jimuLayerInfo) {
          _queries.push(jimuLayerInfo.getLayerType());
        }
        _layerDetails.push({
          jimuLayerInfo: jimuLayerInfo,
          lyrInfo: lyrInfo
        });
      }

      this._getLayerDetails(_queries, _layerDetails).then(lang.hitch(this, function(_details){
        array.forEach(_details, lang.hitch(this, function(_d){
          this.updateLayerList(_d.layerObject, _d.lyrInfo, _d.layerType, _d.jimuLayerInfo);
        }));
        this._initUpdateEnd();
        this.addMapLayers();
        if (!this.hidePanel) {
          //Added timeout to fix the gitHub Ticekt #2 -
          //Info Summary: Panel layer spins with clustering,
          //show all feature, and expand list enabled
          setTimeout(lang.hitch(this, function () {
            this.openAtStartAysn = true;
            this._mapExtentChange(!utils.isAutoFocusFirstNodeWidget(this));
          }), 1000);
        }
        def.resolve();
      }));

      return def;
    },

    _getLayerDetails: function (_queries, _layerDetails) {
      var def = new Deferred();
      var _loQueries = [];
      if (_queries.length > 0) {
        var ltList = new DeferredList(_queries);
        ltList.then(lang.hitch(this, function (queryResults) {
          if (queryResults) {
            for (var i = 0; i < queryResults.length; i++) {
              _layerDetails[i].layerType = queryResults[i][1];
              _loQueries.push(_layerDetails[i].jimuLayerInfo.getLayerObject());
            }
          }
          if (_loQueries.length > 0) {
            var loList = new DeferredList(_loQueries);
            loList.then(lang.hitch(this, function (queryResults) {
              if (queryResults) {
                for (var i = 0; i < queryResults.length; i++) {
                  _layerDetails[i].layerObject = queryResults[i][1];
                }
              }
              def.resolve(_layerDetails);
            }));
          }
        }));
      } else {
        def.resolve(_layerDetails);
      }
      return def;
    },

    _initUpdateEnd: function(){
      if (!this.hidePanel) {
        for (var k in this.layerList) {
          var lyr = this.layerList[k];
          if (lyr.type !== "ClusterLayer") {
            if (lyr && lyr.layerObject) {
              if (lyr.layerObject.hasOwnProperty('refreshInterval') && lyr.layerObject.refreshInterval > 0) {
                this.updateEnd.push(this.own(on(lyr.layerObject, "update-end", lang.hitch(this, this._updateEnd))));
              }
              this.own(on(lyr.layerObject, "edits-complete", lang.hitch(this, this._editsComplete)));
            }
          }
        }
      }
    },

    _editsComplete: function(results) {
      // force load list for the results.target once after edits complete
      this._updateEnd(results);
    },

    _updateEnd: function (results) {
      var lid = this.layerList.hasOwnProperty(results.target.id) ? results.target.id :
        this.layerList.hasOwnProperty(results.target.id + "_CL") ? results.target.id + "_CL" : "";

      //For map service with sub layers...the results ID is for the parent layer
      if (lid === "") {
        for (var i in this.layerList) {
          var l = this.layerList[i];
          if (l && l.layerObject && l.layerObject.id === results.target.id) {
            lid = l.li.id;
            break;
          }
        }
      }
      if (this.layerList.hasOwnProperty(lid)) {
        var lyr = this.layerList[lid];
        lyr.isLoaded = false;
        lyr.updating = false;
        lyr.requiresReload = true;
        if (lyr) {
          if (lyr.legendOpen) {
            this._loadList(lyr, this.config.countEnabled);
          } else if (this.config.countEnabled) {
            this.countFeatures(lyr);
          }
        }
      }
    },

    updateThemeClusterSymbol: function(lyrInfo, i){
      var sd = lyrInfo.symbolData;
      if (this.appConfig.theme.styles && this.appConfig.theme.styles[0]) {
        if (typeof (this._styleColor) === 'undefined') {
          this._updateStyleColor(this.appConfig.theme.styles[0]);
        }
      }
      if (this._styleColor) {
        var _rgb = dojoColor.fromHex(this._styleColor);
        var x = i + 1;
        var xx = x > 0 ? x * 30 : 30;
        var evenOdd = x % 2 === 0;
        var r = _rgb.r;
        var g = _rgb.g;
        var b = _rgb.b;

        var rr = r - xx;
        if (evenOdd) {
          if (rr > 255) {
            rr = rr - 255;
          }
          else if (rr < 0) {
            rr = rr + 255;
          }
        }

        var bb = b - xx;
        if (x % 3 === 0) {
          if (evenOdd) {
            if (bb > 255) {
              bb = bb - 255;
            }
            else if (bb < 0) {
              bb = bb + 255;
            }
          }
        }

        var gg = g - xx;
        if (x % 5 === 0) {
          if (evenOdd) {
            if (gg > 255) {
              gg = gg - 255;
            }
            else if (gg < 0) {
              gg = gg + 255;
            }
          }
        }
        sd.clusterType = 'CustomCluster';
        sd.clusterSymbol = {
          color: [rr, gg, bb, 1],
          outline: {
            color: [0, 0, 0, 0],
            width: 0,
            type: "esriSLS",
            style: "esriSLSNull"
          },
          type: "esriSFS",
          style: "esriSFSSolid"
        };
      }
    },

    removeOldClusterLayers: function (lInfos) {
      //check if the widget was previously configured
      // with a layer that it no longer consumes...if so remove it
      var deleteLayers = [];
      for (var id in this.layerList) {
        var l = this.layerList[id];
        if (l.type === "ClusterLayer") {
          layer_info_loop:
          for (var i = 0; i < lInfos.length; i++) {
            var lo = lInfos[i];
            var potentialNewClusterID = lo.id + this.UNIQUE_APPEND_VAL_CL;
            if (potentialNewClusterID === id) {
              if (lo.symbolData && !lo.symbolData.clusteringEnabled) {
                deleteLayers.push(id);
              }
              break layer_info_loop;
            }
          }
        }
      }
      if (deleteLayers.length > 0) {
        for (var dl in deleteLayers) {
          if (this.layerList.hasOwnProperty(deleteLayers[dl])) {
            if (this.map.graphicsLayerIds.indexOf(deleteLayers[dl]) > -1) {
              var _dl = this.layerList[deleteLayers[dl]];
              if (_dl && _dl.li) {
                var jimuLayerInfo;
                if (_dl.li.parentLayerID) {
                  jimuLayerInfo = this.operLayerInfos.getLayerInfoById(_dl.li.parentLayerID);
                }
                if (!jimuLayerInfo && _dl.li.layer) {
                  jimuLayerInfo = this.operLayerInfos.getLayerInfoById(_dl.li.layer);
                }
                if (jimuLayerInfo && _dl.hasOwnProperty('parentLayerVisible')) {
                  jimuLayerInfo.setTopLayerVisible(_dl.parentLayerVisible);
                }
              }
              this.map.removeLayer(this.layerList[deleteLayers[dl]].layerObject);
            }
            this.layerList[deleteLayers[dl]].layerObject.destroy();
            delete this.layerList[deleteLayers[dl]];
          }
        }
      }
    },

    addMapLayers: function () {
      var ids = Object.keys(this.layerList).reverse();
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var l = this.layerList[id];
        if (l.type && l.type === "ClusterLayer") {
          if (this.map.graphicsLayerIds.indexOf(id) === -1) {
            this.map.addLayer(l.layerObject);
          }
        }
      }
    },

    updateLayerList: function (lyr, lyrInfo, lyrType, jimuLayerInfo) {
      var l, ll  = null;
      var type, id, layerObject, pl;

      jimuLayerInfo = jimuLayerInfo || this.operLayerInfos.getLayerInfoById(lyr.id);

      var selfType = this._checkSelfType(jimuLayerInfo, lyrInfo, lyrType, lyr);
      var listDisabled = this._checkListDisabled(lyrInfo);
      var layerDefinition = utils.getFeatureLayerDefinition(lyr);

      //Handle cluster layers
      if (lyrInfo.symbolData.clusteringEnabled) {
        l = this._getClusterLayer(lyrInfo, lyr, jimuLayerInfo, lyrType, layerDefinition);
        type = "ClusterLayer";
        layerObject = l;
        id = l.id;
        this.clusterLayerArray.push({"clusterLayer": l, "parentID": lyrInfo.id});
        if (!this.hidePanel) {
          this.own(on(l, "update-end", lang.hitch(this, function () {
            this._loadList(this.layerList[l.id], true);
          })));
        }
        this.numClusterLayers += 1;
      } else {
        if (lyr.layerType === "ArcGISStreamLayer") {
          type = "StreamLayer";
          id = lyr.layerObject.id;
          layerObject = lyr.layerObject;
          pl = lyr;
        } else {
          id = lyrType === "FeatureLayer" ? lyrInfo.id : lyr.id;
          var parentLayerInfo = this.operLayerInfos.getLayerInfoById(lyrInfo.parentLayerID) || lyr.parentLayerInfo;
          if (parentLayerInfo) {
            if (parentLayerInfo.layerObject) {
              ll = parentLayerInfo.layerObject;
              type = ll.type;
              if (parentLayerInfo.originOperLayer && parentLayerInfo.originOperLayer.featureCollection) {
                var layers = parentLayerInfo.originOperLayer.featureCollection.layers;
                if (layers) {
                  for (var j = 0; j < layers.length; j++) {
                    var _lyr = layers[j];
                    if (_lyr.id === id) {
                      pl = _lyr;
                    }
                  }
                }
              }
            }
          }
          l = lyr.layerObject ? lyr.layerObject : lyr;
          type = lyrType;
          layerObject = (ll && !ll.empty) ? ll : l ? l : lyr;
          if (selfType === 'geo_rss' && layerObject && layerObject.getFeatureLayers) {
            var featureLayers = layerObject.getFeatureLayers();
            for (var i = 0; i < featureLayers.length; i++) {
              var fl = featureLayers[i];
              if (fl.id === lyrInfo.id) {
                layerObject = fl;
              }
            }
          }
          pl = pl ? pl : lyr;
        }
      }

      this.layerList[id] = {
        type: type,
        layerObject: layerObject,
        pl: pl,
        id: id,
        visible: jimuLayerInfo && jimuLayerInfo.isShowInMap ? jimuLayerInfo.isShowInMap() : true,
        li: lyrInfo,
        filter: jimuLayerInfo ? jimuLayerInfo.getFilter() : "1=1",
        infoTemplate: jimuLayerInfo.getInfoTemplate() || lyrInfo.infoTemplate,
        selfType: selfType,
        listDisabled: listDisabled,
        showAllFeatures: this.showAllFeatures,
        layerDefinition: layerDefinition
      };

      if (lyr.layerType !== "ArcGISStreamLayer") {
        this.updateRenderer(id);
      }

      if (!this.hidePanel) {
        this._addPanelItem(ll ? ll : l ? l : lyr, lyrInfo, listDisabled, jimuLayerInfo);
      }
    },

    _checkListDisabled: function (lyrInfo) {
      return lyrInfo.symbolData.featureDisplayOptions.listDisabled ?
        lyrInfo.symbolData.featureDisplayOptions.listDisabled : lyrInfo.symbolData.featureDisplayOptions.fields ?
          lyrInfo.symbolData.featureDisplayOptions.fields.length === 0 : true;
    },

    _checkSelfType: function (jimuLayerInfo, lyrInfo, lyrType, lyr) {
      var _lo = (lyrInfo.layerObject && !lyrInfo.layerObject.empty) ? lyrInfo.layerObject : lyr;
      var originOpLayer = _lo && _lo.originOperLayer ? _lo.originOperLayer : lyr;

      var selfType = (jimuLayerInfo.originOperLayer && jimuLayerInfo.originOperLayer.selfType) ?
        jimuLayerInfo.originOperLayer.selfType : (originOpLayer && originOpLayer.selfType) ?
          originOpLayer.selfType : '';

      selfType = (selfType && selfType !== '') ? selfType : (originOpLayer && originOpLayer.layerType &&
        originOpLayer.layerType === "CSV") ? "collection" : lyrType === "Feature Collection" ? "collection" :
        lyrType === 'CSVLayer' ? 'collection' : '';
      if (!selfType && lyrType && lyrType === "KML") {
        selfType = "kml";
      }
      return selfType;
    },

    updateRenderer: function (id) {
      var l = this.layerList[id];
      if (l.li.symbolData.symbolType !== 'LayerSymbol') {
        if (typeof (l.li.orgRenderer) === 'undefined') {
          if (l.layerObject.renderer) {
            l.li.orgRenderer = l.layerObject.renderer;
          } else {
            l.li.orgRenderer = l.li.renderer;
          }
        }
        var renderer = new SimpleRenderer(jsonUtils.fromJson(l.li.symbolData.symbol));
        l.li.newRenderer = renderer;
        if (l.layerObject.setLayerDrawingOptions && !isNaN(l.li.subLayerId)) {
          var optionsArray = [];
          var drawingOptions = new LayerDrawingOptions();
          drawingOptions.renderer = renderer;
          optionsArray[l.li.subLayerId] = drawingOptions;
          l.layerObject.setLayerDrawingOptions(optionsArray);
        } else if (l.layerObject.setRenderer) {
          l.layerObject.setRenderer(renderer);
        } else {
          console.log("Error setting the new renderer...will use the default rendering of the layer");
        }

        if (typeof (l.layerObject.refresh) === 'function') {
          l.layerObject.refresh();
        }
      }
    },

    _onRecNodeMouseover: function (rec) {
      domClass.add(rec, this.isDartTheme ? "layer-row-mouseover-dart" :
        (this.isDashboardTheme && !this.isLightTheme) ? "layer-row-mouseover-dashboard" : "layer-row-mouseover");
    },

    _onRecNodeMouseout: function (rec) {
      domClass.remove(rec, this.isDartTheme ? "layer-row-mouseover-dart" :
        (this.isDashboardTheme && !this.isLightTheme) ? "layer-row-mouseover-dashboard" : "layer-row-mouseover");
    },

    _addPanelItem: function (layer, lyrInfo, listDisabled, jimuLayerInfo) {
      var potentialNewID = lyrInfo.id + this.UNIQUE_APPEND_VAL_CL;
      var id = lyrInfo.id in this.layerList ? lyrInfo.id : potentialNewID in this.layerList ? potentialNewID : '';
      var lyr = this.layerList[id];
      if (lyr) {
        var lyrType = lyr.type;
        var cssAry;
        if (this.isDashboardTheme) {
          cssAry = ['rec', 'expand', 'expandDown-dashboard', 'solidBorder'];
        } else if (this.isDartTheme) {
          cssAry = ['rec-dart', 'expand-dart', 'expandDown-dart', 'solidBorder-dart'];
        } else {
          cssAry = ['rec', 'expand', 'expandDown', 'solidBorder'];
        }
        var rec = domConstruct.create("div", {
          'class': cssAry[0] + " " + cssAry[3] + " esriCTInfoLayer",
          id: 'rec_' + id,
          'attr-layerid': id,
          tabindex: 0,
          "aria-label": lyrInfo.label
        }, this.pageMain);

        var expandClass;
        if (!listDisabled) {
          this.own(on(rec, 'mouseover', lang.hitch(this, this._onRecNodeMouseover, rec)));
          this.own(on(rec,  'mouseout', lang.hitch(this, this._onRecNodeMouseout, rec)));
          expandClass = cssAry[1] + " " + cssAry[2];
          if (jimuLayerInfo && jimuLayerInfo.isInScale) {
            expandClass += jimuLayerInfo.isInScale() ? "" : " expandInActive";
          }
        } else {
          html.setStyle(rec, "cursor", "default");
          expandClass = 'expand-empty';
        }

        var recIcon = domConstruct.create("div", {
          'class': "recIcon active sub-active",
          id: "recIcon_" + id,
          'attr-layerid': id,
          tabindex: -1,
          'role': 'button',
          'aria-label': this.nls.logoPrefix + lyrInfo.label
        }, rec);

        var layerExpandArrow = domConstruct.create("div", {
          'class': expandClass,
          id: "exp_" + id,
          tabindex: -1,
          'attr-layerid': id,
          role: "button",
          'aria-label': this.nls.expand,
          'aria-expanded': "false"
        }, rec);

        if (lyrInfo.panelImageData && lyrInfo.panelImageData.toString().indexOf('<img') > -1) {
          var img = document.createElement('div');
          img.innerHTML = lyrInfo.panelImageData;
          var icon = new PictureMarkerSymbol(img.children[0].src, 26, 26);
          lyrInfo.panelImageData = this._createImageDataDiv(icon, 44, 44, undefined, true).innerHTML;
        }
        recIcon.innerHTML = lyrInfo.panelImageData;
        domStyle.set(recIcon.firstChild, "border-radius", "41px");

        var recLabel;
        var recNum;
        if (this.config.countEnabled) {
          recLabel = domConstruct.create("div", {
            'class': "recLabel",
            id: "recLabel_" + id,
            innerHTML: "<p>" + lyrInfo.label + "</p>"
          }, rec);
          html.setStyle(recLabel, "top", "20px");
          recNum = domConstruct.create("div", {
            'class': "recNum",
            id: "recNum_" + id,
            innerHTML: ""
          }, rec);
        } else {
          recLabel = domConstruct.create("div", {
            'class': "recLabelNoCount",
            id: "recLabel_" + id,
            innerHTML: "<p>" + lyrInfo.label + "</p>"
          }, rec);
        }

        if (lyrType === "ClusterLayer") {
          layer.node = recNum;
          if (!listDisabled) {
            this._addLegend(id, lyr);
          }
          layer._updateNode(layer.nodeCount);
        } else if (lyrType === "StreamLayer") {
          lyr.node = recNum;
          this.countFeatures(lyr);
          if (!listDisabled) {
            this._addLegend(id, lyr);
          }
        } else {
          lyr.node = recNum;
          this._addLegend(id, lyr);
        }

        on(recIcon, "click", lang.hitch(this, this._toggleLayerVisibility, lyr));
        // code for accessibility : keydown event of logo icon
        on(recIcon, "keydown", lang.hitch(this, function (evt) {
          if (evt.keyCode === keys.TAB) {
            evt.stopPropagation();
            evt.preventDefault();
            focusUtil.focus(layerExpandArrow);
          } else if (evt.keyCode === keys.ESCAPE) {
            evt.stopPropagation();
            evt.preventDefault();
            domAttr.set(recIcon, "tabindex", -1);
            domAttr.set(layerExpandArrow, "tabindex", -1);
            this._support508Accessibility();
            focusUtil.focus(rec);
          } else if (evt.keyCode === keys.ENTER || evt.keyCode === keys.SPACE) {
            evt.stopPropagation();
            evt.preventDefault();
            this._toggleLayerVisibility(lyr, evt);
            focusUtil.focus(evt.currentTarget);
          }
        }));

        if (!listDisabled) {
          lyr.toggleLegend = on(rec, "click", lang.hitch(this, this._toggleLegend, lyr));
          // code for accessibility : keydown event of layer block
          on(rec, "keydown", lang.hitch(this, function (evt) {
            if (evt.keyCode === keys.ENTER || evt.keyCode === keys.SPACE) {
              evt.stopPropagation();
              evt.preventDefault();
              domAttr.set(recIcon, "tabindex", 0);
              domAttr.set(layerExpandArrow, "tabindex", 0);
              focusUtil.focus(recIcon);
              utils.initFirstFocusNode(this.domNode, recIcon);
              utils.initLastFocusNode(this.domNode, layerExpandArrow);
            }
          }));

          // code for accessibility : keydown event of expand arrow
          on(layerExpandArrow, "keydown", lang.hitch(this, function (evt) {
            var lyr = this.layerList[(evt.currentTarget.id).split("exp_")[1]];
            this.handleArrowLayer(evt, lyr);
          }));
        }

        if(lyr.legendOpen) {
          domAttr.set(layerExpandArrow, "aria-expanded", "true");
        }
        else {
          domAttr.set(layerExpandArrow, "aria-expanded", "false");
        }
      }
    },

    handleArrowLayer: function (evt, lyr) {
      var id = evt.currentTarget.id;
      var layerid = domAttr.get(evt.currentTarget, 'attr-layerid');
      var recId = ("rec_").concat(layerid);
      var recIconId = ("recIcon_").concat(layerid);
      if (evt.keyCode === keys.TAB) {
        evt.stopPropagation();
        evt.preventDefault();
        focusUtil.focus(dom.byId(recIconId));
      } else if (evt.keyCode === keys.ESCAPE) {
        evt.stopPropagation();
        evt.preventDefault();
        domAttr.set(dom.byId(recIconId), "tabindex", -1);
        domAttr.set(dom.byId(id), "tabindex", -1);
        this._support508Accessibility();
        focusUtil.focus(dom.byId(recId));
      } else if (evt.keyCode === keys.ENTER || evt.keyCode === keys.SPACE) {
        evt.stopPropagation();
        evt.preventDefault();
        this._toggleLegend(lyr, evt, true);
      }
    },

    _addLegend: function (id, layerListLayer) {
      layerListLayer.legendOpen = this.row === null && this.config.expandList;
      var _class = layerListLayer.legendOpen ? "legendOn" : "legendOff";
      layerListLayer.legendNode = domConstruct.create("div", {
        "class": "legendLayer " + _class,
        "id": "legend_" + id
      }, this.pageMain);
      if (layerListLayer.type === 'ClusterLayer') {
        layerListLayer.layerObject.legendNode = layerListLayer.legendNode;
      }
      this.row = 'firstRowExpanded';
    },

    _getListFields: function (lyr) {
      var popupFields = [];
      var infoTemp = this._getInfoTemplate(lyr);

      var fieldInfos = (infoTemp && infoTemp.info && infoTemp.info.fieldInfos) ? infoTemp.info.fieldInfos : [];
      array.forEach(fieldInfos, function (fieldInfo) {
        if (fieldInfo.visible && fieldInfo.fieldName.indexOf('/') === -1) {
          popupFields.push(fieldInfo.fieldName);
        }
      });

      var displayOptions = (lyr.li.symbolData && lyr.li.symbolData.featureDisplayOptions) ?
        lyr.li.symbolData.featureDisplayOptions : {};
      var fields = displayOptions.fields || [];
      array.forEach(fields, function (field) {
        if (popupFields.indexOf(field.name) === -1) {
          popupFields.push(field.name);
        }
      });
      if (displayOptions.groupField) {
        if (popupFields.indexOf(displayOptions.groupField.name) === -1) {
          popupFields.push(displayOptions.groupField.name);
        }
      }

      if (popupFields.length === 0 || typeof (infoTemp) === 'undefined') {
        popupFields = ['*'];
      }

      if (popupFields[0] !== '*') {
        if (lyr.layerObject && lyr.layerObject.objectIdField) {
          if (popupFields.indexOf(lyr.layerObject.objectIdField) === -1) {
            popupFields.push(lyr.layerObject.objectIdField);
          }
        }
      }
      return popupFields;
    },

    _loadList: function (lyr, updateCount) {
      if (!this.hidePanel) {
        var id = lyr.layerObject.id in this.layerList ? lyr.layerObject.id : lyr.li.id;
        if (updateCount) {
          this._addSearching(id);
        }

        var popupFields = this._getListFields(lyr);
        if (lyr.type === "ClusterLayer") {
          if (lyr.li.layerListExtentChanged) {
            lyr.layerObject.clusterFeatures();
            lyr.li.layerListExtentChanged = false;
          }
          var features = [];
          if (lyr.layerObject.clusterGraphics || lyr.layerObject._features) {
            if (this.showAllFeatures) {
              features = lyr.layerObject._features;
            } else {
              var clusterGraphics = lyr.layerObject.clusterGraphics;
              for (var z = 0; z < clusterGraphics.length; z++) {
                var clusterGraphic = clusterGraphics[z];
                if (clusterGraphic.graphics && clusterGraphic.graphics.length > 0) {
                  for (var f = 0; f < clusterGraphic.graphics.length; f++) {
                    var g = clusterGraphic.graphics[f];
                    features.push(g);
                  }
                }
              }
            }
            setTimeout(lang.hitch(this, function () {
              this._updateList(features, lyr.legendNode, lyr.layerObject.node, popupFields, updateCount, lyr);
            }), 100);
          } else {
            this._removeSearching(id, lyr.legendNode ? !domClass.contains(lyr.legendNode, 'legendOff') : true);
          }
        } else {
          this.getFeatures(lyr, popupFields, updateCount);
          return;
        }
      }
    },

    _addSearching: function (id, skipSearch) {
      var disabled = this.layerList[id].listDisabled;
      var eD = disabled ? 'expand-empty' : this.isDartTheme ? 'expandDown-dart' :
        (this.isDashboardTheme && !this.isLightTheme) ? 'expandDown-dashboard' : 'expandDown';
      var eU = disabled ? 'expand-empty' : this.isDartTheme ? 'expandUp-dart' :
        (this.isDashboardTheme && !this.isLightTheme) ? 'expandUp-dashboard' : 'expandUp';
      var eS = disabled ? "expandSearching-empty" : "expandSearching";
      var nodeID = "exp_" + id;
      if (dom.byId(nodeID)) {
        if (domClass.contains(nodeID, eD)) {
          domClass.remove(nodeID, eD);
          if (skipSearch) {
            domClass.add(nodeID, eU);
          } else {
            domClass.add(nodeID, eS);
          }
        } else if (domClass.contains(nodeID, eU)) {
          domClass.remove(nodeID, eU);
          if (skipSearch) {
            domClass.add(nodeID, eD);
          } else {
            domClass.add(nodeID, eS);
          }
        }
      }
    },

    _removeSearching: function (id, legendOpen) {
      var disabled = this.layerList[id].listDisabled;
      var eD = disabled ? 'expand-empty' : this.isDartTheme ? 'expandDown-dart' :
        (this.isDashboardTheme && !this.isLightTheme) ? 'expandDown-dashboard' : 'expandDown';
      var eU = disabled ? 'expand-empty' : this.isDartTheme ? 'expandUp-dart' :
        (this.isDashboardTheme && !this.isLightTheme) ? 'expandUp-dashboard' : 'expandUp';
      var eS = disabled ? "expandSearching-empty" : "expandSearching";
      var nodeID = "exp_" + id;
      if (dom.byId(nodeID)) {
        if (domClass.contains(nodeID, eS)) {
          domClass.remove(nodeID, eS);
          domClass.add(nodeID, legendOpen ? eU : eD);
        }
        if (legendOpen) {
          this._setFeatureItemFocused(id);
        }
      }
    },

    // code for accessibility : to set feature item focused
    _setFeatureItemFocused: function (layerId) {
      if (layerId) {
        var curreLegendId, currLegend, curreRecIconId, curreExpandId, featureItemArray,
        featureItemArrayLen, groupItemArray,groupItemTitleArray, clusteringEnabled;
        clusteringEnabled = this._getClusteringEnabledValue(layerId);
        curreLegendId = ("legend_").concat(layerId);
        curreRecIconId = ("recIcon_").concat(layerId);
        curreExpandId = ("exp_").concat(layerId);
        if(clusteringEnabled && (layerId.lastIndexOf("_CL", layerId.length - 3) === -1)) {
          curreLegendId = curreLegendId + "_CL";
          curreRecIconId = curreRecIconId + "_CL";
          curreExpandId = curreExpandId + "_CL";
        }
        currLegend = dom.byId(curreLegendId);
        groupItemArray = query(".groupItem", currLegend);
        if(groupItemArray.length) {
          domAttr.set(dom.byId(curreRecIconId), "tabIndex", -1);
          domAttr.set(dom.byId(curreExpandId), "tabIndex", -1);
          this._support508Accessibility(true);
          groupItemTitleArray = query('.groupItemTitle' || '.groupItemTitle-dart', currLegend);
          if(groupItemTitleArray.length) {
            if (!this.initialOpen) {
              focusUtil.focus(groupItemTitleArray[0]);
            }
          }
        }
        else {
          featureItemArray = query(".featureItem" || ".featureItem-dart", currLegend);
          featureItemArrayLen = featureItemArray.length;
          if (featureItemArrayLen) {
            domAttr.set(dom.byId(curreRecIconId), "tabIndex", -1);
            domAttr.set(dom.byId(curreExpandId), "tabIndex", -1);
            this._support508Accessibility(true);
            if (!this.initialOpen) {
              focusUtil.focus(featureItemArray[0]);
            }
          }
        }
      }
    },

    // returns clustering is enabled or not for layer
    _getClusteringEnabledValue: function (layerId) {
      var configLayerIndex;
      if(layerId.lastIndexOf("_CL", layerId.length - 3) > -1){
        layerId = layerId.split("_CL")[0];
      }
      for(configLayerIndex in this.configLayerInfos) {
        var currLayer = this.configLayerInfos[configLayerIndex];
        if(currLayer.id === layerId) {
          return currLayer.symbolData.clusteringEnabled;
        }
      }
    },

    _getClusterLayer: function (lyrInfo, layer, jimuLayerInfo, lyrType, layerDefinition) {
      var lyr = layer.layerObject ? layer.layerObject : layer;
      var infoTemplate = lyrInfo.infoTemplate;
      var originOperLayer = lyr && lyr.originOperLayer ? lyr.originOperLayer : layer.parentLayerInfo ?
        layer.parentLayerInfo : jimuLayerInfo ? jimuLayerInfo.originOperLayer : undefined;
      var clusterLayer = null;
      var n;
      var potentialNewID = lyrInfo.id + this.UNIQUE_APPEND_VAL_CL;
      var configChange = true;
      if (this.map.graphicsLayerIds.indexOf(potentialNewID) > -1 || this.map._layers.indexOf(potentialNewID) > -1) {
        clusterLayer = this.map.getLayer(potentialNewID);

        var reloadData = false;
        var refreshData = false;

        //update the symbol if it has changed
        if (JSON.stringify(clusterLayer.symbolData) !== JSON.stringify(lyrInfo.symbolData)) {
          clusterLayer.symbolData = lyrInfo.symbolData;
          clusterLayer.countColor = lyrInfo.symbolData._highLightColor;
          refreshData = true;
        }

        //update the icon if it has changed
        n = domConstruct.toDom(lyrInfo.panelImageData);
        if (JSON.stringify(clusterLayer.icon) !== JSON.stringify(n.src)) {
          clusterLayer.icon = n.src;
          refreshData = true;
        }
        domConstruct.destroy(n.id);

        clusterLayer.displayFeatureCount = lyrInfo.symbolData.displayFeatureCount;

        if (clusterLayer.refresh !== lyrInfo.refresh) {
          clusterLayer.refresh = lyrInfo.refresh;
          reloadData = true;
        }

        if (refreshData) {
          clusterLayer._setupSymbols();
        }

        clusterLayer.countEnabled = this.config.countEnabled;
        clusterLayer.hidePanel = this.hidePanel;

        if (clusterLayer.showAllFeatures !== this.showAllFeatures) {
          reloadData = true;
          clusterLayer.showAllFeatures = this.showAllFeatures;
        }
        if (clusterLayer.listDisabled !== this.listDisabled) {
          reloadData = true;
          clusterLayer.listDisabled = this.listDisabled;
        }

        if (reloadData) {
          if (clusterLayer.url) {
            clusterLayer.refreshFeatures(clusterLayer.url);
          }
        } else if (refreshData) {
          clusterLayer.clusterFeatures();
        }
      } else {
        configChange = false;
        clusterLayer = new ClusterLayer({
          name: lyrInfo.label + this.UNIQUE_APPEND_VAL_CL,
          id: potentialNewID,
          map: this.map,
          node: dom.byId("recNum_" + potentialNewID),
          legendNode: dom.byId("legend_" + potentialNewID),
          infoTemplate: typeof (lyr.infoTemplate) !== 'undefined' ? lyr.infoTemplate : infoTemplate,
          refreshInterval: this.config.refreshInterval,
          refreshEnabled: this.config.refreshEnabled,
          parentLayer: lyr,
          lyrInfo: lyrInfo,
          lyrType: lyrType,
          _styleColor: this._styleColor,
          originOperLayer: originOperLayer,
          countEnabled: this.config.countEnabled,
          hidePanel: this.hidePanel,
          filter: jimuLayerInfo ? jimuLayerInfo.getFilter() : "1=1",
          showAllFeatures: this.showAllFeatures,
          listDisabled: this.listDisabled,
          _parent: this,
          layerDefinition: layerDefinition,
          staticLayers: this.staticLayers
        });
      }
      clusterLayer.setVisibility(configChange ? clusterLayer.visible :
        jimuLayerInfo.isShowInMap ? jimuLayerInfo.isShowInMap() : true);
      return clusterLayer;
    },

    _createImageDataDiv: function (sym, w, h, parent, isCustom) {
      var a;
      var symbol = sym;
      if (symbol) {
        //TODO are these switched??
        var height = w;
        var width = h;
        if (symbol.height && symbol.width) {
          var ar;
          if (symbol.height > symbol.width) {
            ar = symbol.width / symbol.height;
            width = w * ar;
          } else if (symbol.width === symbol.height || symbol.width > symbol.height) {
            width = w;
            ar = symbol.width / symbol.height;
            height = (ar > 0) ? h * ar : h;
          }
        }
        if (typeof (symbol.setWidth) !== 'undefined') {
          if (typeof (symbol.setHeight) !== 'undefined') {
            symbol.setWidth(isCustom ? width - (width * 0.25) : width);
            symbol.setHeight(isCustom ? height - (height * 0.25) : height);
          } else {
            symbol.setWidth(2);
          }
        } else if (typeof (symbol.size) !== 'undefined') {
          if (symbol.size > 20) {
            symbol.setSize(20);
          }
        }
        a = domConstruct.create("div", { 'class': "imageDataGFX" }, parent);
        var mySurface = gfx.createSurface(a, w, h);
        var descriptors = jsonUtils.getShapeDescriptors(symbol);
        var shape = mySurface.createShape(descriptors.defaultShape)
          .setFill(descriptors.fill)
          .setStroke(descriptors.stroke);
        shape.applyTransform({ dx: w / 2, dy: h / 2 });
      }
      return a;
    },

    _updateUI: function (styleName) {
      this.styleName = styleName;

      if (this.isDashboardTheme) {
        this.isLightTheme = styleName ? styleName === 'light' : this.isLightTheme;

        var removeDownClass = this.isLightTheme ? 'expandDown-dashboard' : 'expandDown';
        var addDownClass = this.isLightTheme ? 'expandDown' : 'expandDown-dashboard';
        this._updateNodes(removeDownClass, addDownClass);

        var removeUpClass = this.isLightTheme ? 'expandUp-dashboard' : 'expandUp';
        var addUpClass = this.isLightTheme ? 'expandUp' : 'expandUp-dashboard';
        this._updateNodes(removeUpClass, addUpClass);

        var removeExpandClass = this.isLightTheme ? 'expand-dashboard' : 'expand';
        var addExpandClass = this.isLightTheme ? 'expand' : 'expand-dashboard';
        this._updateNodes(removeExpandClass, addExpandClass);

        var removeGroupItemUpClass = this.isLightTheme ? 'groupItemImageUp-dashboard' : 'groupItemImageUp';
        var addGroupItemUpClass = this.isLightTheme ? 'groupItemImageUp' : 'groupItemImageUp-dashboard';
        this._updateNodes(removeGroupItemUpClass, addGroupItemUpClass);

        var removeGroupItemDownClass = this.isLightTheme ? 'groupItemImageDown-dashboard' : 'groupItemImageDown';
        var addGroupItemDownClass = this.isLightTheme ? 'groupItemImageDown' : 'groupItemImageDown-dashboard';
        this._updateNodes(removeGroupItemDownClass, addGroupItemDownClass);

        var removeGroupItemClass = this.isLightTheme ? 'groupItemImage-dashboard' : 'groupItemImage';
        var addGroupItemClass = this.isLightTheme ? 'groupItemImage' : 'groupItemImage-dashboard';
        this._updateNodes(removeGroupItemClass, addGroupItemClass);
      }
    },

    _updateNodes: function (remove, add) {
      var nodes = query('.' + remove);
      array.forEach(nodes, function (node) {
        domClass.remove(node, remove);
        domClass.add(node, add);
      });
    },

    _toggleLayerVisibility: function (obj, e) {
      e.stopPropagation();
      this.map.infoWindow.hide();
      var id = obj.id ? obj.id : obj.layerObject.id;
      var lyr = this.layerList[id];
      if (!lyr) {
        if (obj.pl) {
          id = obj.pl.id;
        }
        lyr = this.layerList[id];
      }

      if (lyr) {
        var nulls = [null, undefined, 'null', 'undefined'];
        var hasSubLayerId = lyr.li && lyr.li.hasOwnProperty("subLayerId") ?
          (nulls.indexOf(lyr.li.subLayerId) === -1 && lyr.li.subLayerId.toString() !== "-1") : false;

        var lyrInfo = this.operLayerInfos.getLayerInfoById(id);
        var _vis = !domClass.contains("recIcon_" + id, "active");
        if (hasSubLayerId && lyr.type !== 'ClusterLayer') {
          if (_vis) {
            var currentLayerInfo = lyrInfo.parentLayerInfo;
            while (currentLayerInfo) {
              currentLayerInfo.setTopLayerVisible(true);
              currentLayerInfo = currentLayerInfo.parentLayerInfo;
            }
          }
          lyrInfo.setTopLayerVisible(_vis);
        } else if (lyr) {
          lyr.layerObject.setVisibility(_vis);
          if (lyr.type === 'ClusterLayer' && _vis) {
            lyr.layerObject.handleMapExtentChange({ levelChange: true });
            lyr.layerObject.flashFeatures();
          }
          if (typeof (lyr.pl) !== 'undefined') {
            lyr.pl.visibility = _vis;
            if (this.map.graphicsLayerIds.indexOf(id) > -1) {
              var l = this.map.getLayer(id);
              l.setVisibility(_vis);
            }
          }
        }
      }
    },

    _toggleLayerUI: function (obj, vis, visScaleRange) {
      var id = obj.id ? obj.id : obj.layerObject.id;
      var lyr = this.layerList[id];
      if (!lyr) {
        if (obj.pl) {
          id = obj.pl.id;
        }
        lyr = this.layerList[id];
      }
      if (lyr) {
        var c = dom.byId("recLabel_" + id);

        this.layerList[id].visible = vis;
        this.layerList[id].parentLayerVisible = vis;
        this.layerList[id].visScaleRange = visScaleRange;
        if (this.layerList[id].type === 'ClusterLayer') {
          this.layerList[id].layerObject.parentLayerVisible = vis;
        }
        if (this.config.countEnabled) {
          if (domClass.contains("recNum_" + id, !vis ? "recNum" : "recNumInActive")) {
            this._updatePanel(lyr, id);
            var _append = this.isDartTheme ? ' darkThemeColor' : ' lightThemeColor';
            domClass.remove("recNum_" + id, !vis ? "recNum" : "recNumInActive");
            domClass.add("recNum_" + id, (!vis ? "recNumInActive" : "recNum") + _append);
          }
        }

        var eD = this.isDartTheme ? 'expandDown-dart' :
          (this.isDashboardTheme && !this.isLightTheme) ? 'expandDown-dashboard' : 'expandDown';
        var eU = this.isDartTheme ? 'expandUp-dart' :
          (this.isDashboardTheme && !this.isLightTheme) ? 'expandUp-dashboard' : 'expandUp';

        var recInActive = domClass.contains("rec_" + id, 'inActive');
        if (!vis || !visScaleRange) {
          var iconFunc = !vis ? domClass.remove : domClass.add;
          iconFunc("recIcon_" + id, "active");
          if (!recInActive) {
            iconFunc("recIcon_" + id, "sub-active");
          }
          if (c && c.firstChild && !recInActive) {
            var childFunc = !vis ? domClass.add : domClass.remove;
            childFunc(c.firstChild, "inActive");
          }
          if (!domClass.contains("exp_" + id, "expandInActive")) {
            domClass.add("exp_" + id, "expandInActive");
          }
          if (lyr.legendOpen) {
            if (domClass.contains("legend_" + id, "legendOn")) {
              domClass.remove("legend_" + id, "legendOn");
              domClass.add("legend_" + id, "legendOff");
              if (domClass.contains("exp_" + id, eU)) {
                domClass.remove("exp_" + id, eU);
                domClass.add("exp_" + id, eD);
              }
              domAttr.set(dom.byId("exp_" + id), "aria-expanded", "false");
            }
          }
          if (lyr.toggleLegend) {
            lyr.toggleLegend.remove();
          }
          if (domClass.contains("rec_" + id, "rec")) {
            domClass.add("rec_" + id, "recDefault");
          }

          if(!visScaleRange) {
            var subNode = dom.byId("recIcon_" + id);
            if ((subNode && domClass.contains(subNode, 'sub-active')) || !subNode) {
              domClass.add("rec_" + id, "inActive");
              domAttr.set("rec_" + id, "tabindex", -1);
            }
          }
        } else {
          domClass.add("recIcon_" + id, "active");
          if (!recInActive) {
            domClass.add("recIcon_" + id, "sub-active");
          }
          if (c && c.firstChild && !recInActive) {
            domClass.remove(c.firstChild, "inActive");
          }
          if (domClass.contains("exp_" + id, "expandInActive") && visScaleRange) {
            domClass.remove("exp_" + id, "expandInActive");
          }
          if (lyr.toggleLegend) {
            lyr.toggleLegend.remove();
          }
          var rec = dom.byId('rec_' + id);
          if (rec) {
            lyr.toggleLegend = on(rec, "click", lang.hitch(this, this._toggleLegend, lyr));
            if(domClass.contains(rec.id, "inActive") && visScaleRange){
              domClass.remove(rec.id, "inActive");
              domAttr.set(rec.id, "tabindex", 0);
            }
          }

          if (domClass.contains("rec_" + id, "recDefault")) {
            domClass.remove("rec_" + id, "recDefault");
          }

          if (!lyr.listDisabled) {
            if (!this.showAllFeatures || this.showAllFeatures && (!lyr.hasOwnProperty('isLoaded') || !lyr.isLoaded)) {
              this._loadList(lyr, true);
            }
            if (lyr.legendOpen) {
              domClass.add("legend_" + id, "legendOn");
              domClass.remove("legend_" + id, "legendOff");
              if (domClass.contains("exp_" + id, eD)) {
                domClass.remove("exp_" + id, eD);
                domClass.add("exp_" + id, eU);
              }
              domAttr.set(dom.byId("exp_" + id), "aria-expanded", "true");
              focusUtil.focus(dom.byId("recIcon_" + id));
            }
          }
        }
      }
      return false;
    },

    _toggleLegend: function (obj, evt, keydownEvt) {
      if (evt.currentTarget.className !== 'thumb2' && evt.currentTarget.className !== 'recIcon') {
        var id = obj.layerObject.id in this.layerList ? obj.layerObject.id : obj.li.id;
        if (domClass.contains("legend_" + id, "legendOff")) {
          if (!this.showAllFeatures || !this.layerList[id].isLoaded) {
            this._addSearching(id);
          } else {
            this._addSearching(id, true);
          }
          this.layerList[id].legendOpen = true;
          if (typeof (this.layerList[id].li.layerListExtentChanged) === 'undefined' ||
            this.layerList[id].requiresReload) {
            this.layerList[id].li.layerListExtentChanged = true;
            this.layerList[id].requiresReload = false;
          }
          if (this.layerList[id].li.layerListExtentChanged) {
            setTimeout(lang.hitch(this, function () {
              this._loadList(obj, false);
            }), 500);
          } else {
            this._removeSearching(id, true);
          }
          domClass.remove("legend_" + id, "legendOff");
          domClass.add("legend_" + id, "legendOn");
          domAttr.set(dom.byId("exp_" + id), "aria-expanded", "true");
          if (keydownEvt) {
            this._setFeatureItemFocused(id);
          }

        } else {
          if (domClass.contains("legend_" + id, "legendOn")) {
            this.layerList[id].legendOpen = false;
            var eD = this.isDartTheme ? 'expandDown-dart' :
              (this.isDashboardTheme && !this.isLightTheme) ? 'expandDown-dashboard' : 'expandDown';
            var eU = this.isDartTheme ? 'expandUp-dart' :
              (this.isDashboardTheme && !this.isLightTheme) ? 'expandUp-dashboard' : 'expandUp';
            if (domClass.contains("exp_" + id, eU)) {
              domClass.remove("exp_" + id, eU);
              domClass.add("exp_" + id, eD);
            }
            domClass.remove("legend_" + id, "legendOn");
            domClass.add("legend_" + id, "legendOff");
            domAttr.set(dom.byId("exp_" + id), "aria-expanded", "false");
          }
        }
      }
      evt.stopPropagation();
    },

    _toggleGroup: function (obj, e) {
      var id = e.currentTarget.id.slice(0, -2);
      var fI = this.isDartTheme ? 'featureItem-dart' : 'featureItem';

      var toggle = true;
      if (e.target.parentNode) {
        if (e.target.parentNode.id !== "") {
          if (domClass.contains(e.target.parentNode.id, fI)) {
            toggle = false;
          }
        }
        if (e.target.id !== "") {
          if (domClass.contains(e.target.id, fI)) {
            toggle = false;
          }
        }
      }

      var gII = this.isDartTheme ? "groupItemImage-dart" :
        (this.isDashboardTheme && !this.isLightTheme) ? "groupItemImage-dashboard" : "groupItemImage";
      var gIIUp = this.isDartTheme ? "groupItemImageUp-dart" :
        (this.isDashboardTheme && !this.isLightTheme) ? "groupItemImageUp-dashboard" : "groupItemImageUp";
      var gIIDown = this.isDartTheme ? "groupItemImageDown-dart" :
        (this.isDashboardTheme && !this.isLightTheme) ? "groupItemImageDown-dashboard" : "groupItemImageDown";
      if (toggle) {
        var lId = obj.layerObject.id in this.layerList ? obj.layerObject.id : obj.li.id;
        var node = document.getElementById(e.currentTarget.id);
        var _idx = node.childNodes[0].childNodes.length - 1;
        if (domClass.contains(id, "groupOff")) {
          if (this.layerList[lId].openGroups && this.layerList[lId].openGroups.length > 0) {
            if (this.layerList[lId].openGroups.indexOf(id) === -1) {
              this.layerList[lId].openGroups.push(id);
            }
          } else {
            this.layerList[lId].openGroups = [id];
          }
          domClass.remove(id, "groupOff");
          domClass.add(id, "groupOn");
          this._updateLastNode();
          this.layerList[lId].groupOpen = true;
          if (node.childNodes[0].childNodes[_idx].childNodes[0].className.indexOf(gII) > -1) {
            html.removeClass(node.childNodes[0].childNodes[_idx].childNodes[0], gIIDown);
            html.addClass(node.childNodes[0].childNodes[_idx].childNodes[0], gIIUp);
          }
        } else {
          if (domClass.contains(id, "groupOn")) {
            domClass.remove(id, "groupOn");
            domClass.add(id, "groupOff");
            this._updateLastNode();
            if (this.layerList[lId].openGroups && this.layerList[lId].openGroups.length > 0) {
              var idx = this.layerList[lId].openGroups.indexOf(id);
              if (idx > -1) {
                this.layerList[lId].openGroups.splice(idx, 1);
              }
              if(this.layerList[lId].openGroups.length === 0){
                this.layerList[lId].groupOpen = false;
              }
            } else {
              this.layerList[lId].groupOpen = false;
            }
            if (node.childNodes[0].childNodes[_idx].childNodes[0].className.indexOf(gII) > -1) {
              html.removeClass(node.childNodes[0].childNodes[_idx].childNodes[0], gIIUp);
              html.addClass(e.currentTarget.childNodes[0].childNodes[_idx].childNodes[0], gIIDown);
            }
          }
        }
      }
    },

    /*jshint unused:false*/
    onAppConfigChanged: function (appConfig, reason, changedData) {
      switch (reason) {
        case 'themeChange':
          this.inPanelOverrides(changedData);
          this.destroy();
          break;
        case 'layoutChange':
          this.inPanelOverrides(changedData);
          break;
        case 'styleChange':
          if (!this.hidePanel) {
            this._updateUI(changedData);
            this._updateStyleColor(changedData);
          }
          break;
        case 'widgetChange':
          this.widgetChange = true;
          if (changedData && changedData.config && changedData.config.layerInfos) {
            this.removeOldClusterLayers(changedData.config.layerInfos);
          }
          this.row = null;
          break;
        case 'mapChange':
          this._clearMap();
      }
    },

    _updateStyleColor: function (changedData) {
      setTimeout(lang.hitch(this, function () {
        var p = this.getPanel();
        var node;
        switch (this.appConfig.theme.name) {
          case 'BoxTheme':
            node = p.containerNode.parentNode.parentNode.children[0];
            break;
          case 'DartTheme':
            node = p.containerNode.parentNode;
            break;
          case 'TabTheme':
            node = p.containerNode;
            break;
          case 'BillboardTheme':
            node = p.containerNode.parentNode;
            break;
          case 'FoldableTheme':
            node = p.containerNode.parentNode.firstChild;
            break;
          default:
            node = this.pageHeader;
            break;
        }
        var bc = window.getComputedStyle(node, null).getPropertyValue('background-color');
        //IE returns the word transparent while the other browsers return "rgba(0, 0, 0, 0)"
        if(bc === 'transparent' || [null, undefined].indexOf(Color.fromRgb(bc).toHex()) !== -1) {
          bc = "rgba(0, 0, 0, 0)";
        }
        this._styleColor = Color.fromRgb(bc).toHex();
        for (var k in this.layerList) {
          var l = this.layerList[k];
          if (l.type === "ClusterLayer") {
            l.layerObject.setStyleColor(this._styleColor);
          }
        }
        this._updateUI(changedData);
      }), 50);
    },

    _clearMap: function () {
      if (this.layerList) {
        for (var k in this.layerList) {
          var l = this.layerList[k];
          if (l.type === "ClusterLayer") {
            var _clear = true;
            if (typeof (this.continuousRefreshEnabled) !== 'undefined') {
              _clear = !this.continuousRefreshEnabled;
            }
            if (_clear) {
              l.layerObject._clear();
              this.map.removeLayer(l.layerObject);
            }
          }
        }
        this.layerList = {};
      }
    },

    _close: function () {
      this.widgetManager.closeWidget(this.id);
    },

    onClose: function () {
      this.inherited(arguments);
      this.isOpen = false;
      for (var key in this.layerList) {
        var layerListLayer = this.layerList[key];
        if (layerListLayer.li && layerListLayer.li.orgRenderer) {
          if (layerListLayer.layerObject.setLayerDrawingOptions && !isNaN(layerListLayer.li.subLayerId)) {
            try {
              var ldo = layerListLayer.layerObject.layerDrawingOptions;
              var _renderFromJson = JSON.parse(layerListLayer.li.rendererJson);
              ldo[layerListLayer.li.subLayerId].renderer = jsonUtil.fromJson(_renderFromJson);
              layerListLayer.layerObject.setLayerDrawingOptions(ldo);
            } catch (error) {
              console.log(error);
              layerListLayer.layerObject.setLayerDrawingOptions([]);
            }
          } else if (layerListLayer.layerObject.setRenderer) {
            layerListLayer.layerObject.setRenderer(layerListLayer.li.orgRenderer);
          } else {
            console.log("Error re-setting the renderer");
          }
          // to avoid type error for refresh added below condition
          if (typeof (layerListLayer.layerObject.refresh) === 'function') {
            layerListLayer.layerObject.refresh();
          }
        }
      }

      var disableRefresh = true;
      if (typeof (this.config.continuousRefreshEnabled) !== 'undefined') {
        disableRefresh = !this.config.continuousRefreshEnabled;
      }
      if (disableRefresh) {
        if (this.refreshInterval !== 0) {
          this.refreshIntervalValue = 0;
          clearInterval(this.refreshInterval);
          this.refreshInterval = 0;
        }
      }

      if (!this.hidePanel) {
        if (typeof (this.mapExtentChangedHandler) !== 'undefined') {
          this.mapExtentChangedHandler.remove();
          this.mapExtentChangedHandler = undefined;
        } else {
          if (typeof (this.iconClickHandler) !== 'undefined') {
            this.iconClickHandler.remove();
            this.iconClickHandler = undefined;
          }
        }
      }
      // to handle destroy clustering
      if(this.config.hasOwnProperty("displayClusterLayer") && this.config.displayClusterLayer === false) {
        //delete clusterlayers and show parent layers if visible
        if(this.clusterLayerArray.length) {
          array.forEach(this.clusterLayerArray, lang.hitch(this, function(clusterLayerObj) {
            var parentID, parentLayer;
            clusterLayerObj.clusterLayer.hide();
            parentID = clusterLayerObj.parentID;
            parentLayer = this.operLayerInfos.getLayerInfoById(parentID);
            if(parentLayer) {
              parentLayer.show();
            }
          }));
        }
      }
    },

    _clearChildNodes: function (parentNode) {
      while (parentNode.hasChildNodes()) {
        parentNode.removeChild(parentNode.lastChild);
      }
    },

    _inVisibleRange: function (id) {
      var visScaleRange = true;
      var lyrInfo = this.operLayerInfos.getLayerInfoById(id);
      if (lyrInfo && lyrInfo.isCurrentScaleInTheScaleRange) {
        visScaleRange = lyrInfo.isInScale();
      }
      return visScaleRange;
    },

    _mapExtentChange: function (focusFlag) {
      for (var key in this.layerList) {
        var lyr = this.layerList[key];
        this._updatePanel(lyr, key);
      }
      this._support508Accessibility(typeof focusFlag === "boolean" ? focusFlag : undefined);
    },

    _updatePanel: function (lyr, key) {
      lyr.visScaleRange = this._inVisibleRange(key);
      if (!this.showAllFeatures) {
        this._clearList(lyr);
      }
      if (!lyr.legendOpen || (lyr.groupEnabled && !lyr.groupOpen)) {
        if (lyr.li) {
          lyr.li.layerListExtentChanged = true;
        }
        if (lyr.visible && lyr.visScaleRange) {
          if (lyr.type === "ClusterLayer" && lyr.layerObject.initalLoad && this.config.countEnabled) {
            lyr.layerObject._updateNode(lyr.layerObject.node.innerHTML);
          }

          if (lyr.type !== 'ClusterLayer') {
            if (typeof (lyr.layerObject) === 'undefined') {
              console.log("layer object not known");
            } else {
              this.countFeatures(lyr);
            }
          }
        } else if (!lyr.visScaleRange) {
          this._updateList([], lyr.legendNode, lyr.node, [], true, lyr);
        }
      } else {
        if (lyr.visible && lyr.visScaleRange) {
          lyr.updateList = true;
          this._loadList(lyr, lyr.updateList);
        } else {
          this._updateList([], lyr.legendNode, lyr.node, [], true, lyr);
        }
      }
    },

    getFeatures: function (lyrInfo, fields, updateCount) {
      var lyr = lyrInfo.layerObject;
      var legendNode = lyrInfo.legendNode;
      var node = lyrInfo.node;
      var _needsGeom = !lyrInfo.listDisabled || this.showAllFeatures ? true : false;
      var visScaleRange = lyrInfo.visScaleRange;
      var maxRecordCount = (lyr && lyr.maxRecordCount) ? lyr.maxRecordCount : undefined;
      var forceLoad = this.showAllFeatures && !lyrInfo.isLoaded;
      var url;
      var queries = [];
      var q = this._getQuery(lyrInfo, fields, _needsGeom);
      if ((lyrInfo.visible && visScaleRange) || forceLoad) {
        if (lyr.queryFeatures) {
          if (!this.showAllFeatures || forceLoad) {
            //get the first set of features
            if (!lyrInfo.listDisabled) {
              if (this.staticLayers.indexOf(lyrInfo.type) > -1 || !lyr.url) {
                queries.push(lyr.queryFeatures(q))
              } else {
                var queryTask = new QueryTask(lyr.url);
                queries.push(queryTask.execute(q));
              }
            }
            //query the ids incase we need more than maxRecordCount
            queries.push(lyr.queryIds(q));
          }
        } else {
          url = lyrInfo.li.url;
          if ((url.indexOf("MapServer") > -1 || url.indexOf("FeatureServer") > -1) &&
            url.indexOf("WFSServer") === -1) {
            var qt = new QueryTask(url);
            //get the first set of features
            if (!lyrInfo.listDisabled) {
              queries.push(qt.execute(q));
            }
            //query the ids incase we need more than maxRecordCount
            queries.push(qt.executeForIds(q));
          } else if (url.indexOf("WFSServer") > -1 || (lyrInfo.type && lyrInfo.type === 'WFSLayer')) {
            var def = new Deferred();
            def.resolve(this._queryWFS(lyr && lyr.graphics ? lyr.graphics : []));
            queries.push(def);
          }
        }
      } else {
        //if it's not visible and not within the visible scale range
        this._updateList([], lyrInfo.legendNode, lyrInfo.node, [], true, lyrInfo);
      }
      if (queries.length > 0) {
        var featurePromises = all(queries);
        featurePromises.then(lang.hitch(this, function (results) {
          var s_id = lyrInfo.layerObject.id in this.layerList ? lyrInfo.layerObject.id : lyrInfo.li.id;
          var updateNode;
          if (node) {
            updateNode = this.config.countEnabled ? node.parentNode : node.previousSibling;
          }
          if ((lyrInfo.type && lyrInfo.type === 'WFSLayer' ||
            (lyrInfo.li && lyrInfo.li.url && lyrInfo.li.url.indexOf("WFSServer") > -1)) &&
            results[0] && results[0].hasOwnProperty('length')) {
            var _cnt = results[0].length;
            if (this.config.countEnabled) {
              node.innerHTML = utils.localizeNumber(_cnt);
            }
            this._removeSearching(s_id, false);
            this._updateList(results[0], legendNode, node, fields, _cnt, lyrInfo);
          } else if (results && results.length > 1) {
            var _queries = [];
            var queryIDs = results[1];
            var count = 0;
            //if IDs exceed max count we need to chunk
            if (queryIDs && maxRecordCount && maxRecordCount > 0 && queryIDs.length > maxRecordCount) {
              this._chunkRequest(lyr, lyrInfo, url, queryIDs, maxRecordCount, fields, _needsGeom).then(lang.hitch(this,
                function (fullFeatures) {
                this._updateList(fullFeatures, legendNode, node, fields, updateCount, lyrInfo);
              }));
            } else {
              this._updateList(results[0].features, legendNode, node, fields, updateCount, lyrInfo);
            }
          } else if (results && results.length === 1) {
            if (this.config.countEnabled) {
              node.innerHTML = utils.localizeNumber(results[0].length);
            }
            this._removeSearching(s_id, false);
          } else {
            if (this.config.countEnabled) {
              node.innerHTML = utils.localizeNumber(0);
            }
            this.updateExpand(updateNode, true);
            this._removeSearching(s_id, lyrInfo.legendOpen);
          }
        }), function(err){
          console.log(err);
        });
      } else {
        var l_id = lyrInfo.layerObject.id in this.layerList ? lyrInfo.layerObject.id : lyrInfo.li.id;
        this._removeSearching(l_id, lyrInfo.legendOpen);
      }
    },

    _chunkRequest: function (lyr, lyrInfo, url, IDs, max, fields, needsGeom) {
      var def = new Deferred();
      var queries = [];
      var i, j;
      for (i = 0, j = IDs.length; i < j; i += max) {
        var ids = IDs.slice(i, i + max);

        var q = new Query();
        q.outFields = fields;
        q.objectIds = ids;
        q.returnGeometry = needsGeom;
        q.outSpatialReference = this.map.spatialReference;

        if ((lyr.url || url) && this.staticLayers.indexOf(lyrInfo.type) < 0) {
          var qt = new QueryTask(lyr.url || url);
          queries.push(qt.execute(q));
        } else {
          queries.push(lyr.queryFeatures(q))
        }
      }
      var queryList = new DeferredList(queries);
      queryList.then(lang.hitch(this, function (queryResults) {
        if (queryResults) {
          var allFeatures = [];
          for (var i = 0; i < queryResults.length; i++) {
            if (queryResults[i][1].features) {
              allFeatures.push.apply(allFeatures, queryResults[i][1].features);
            }
          }
          def.resolve(allFeatures);
        }
      }));
      return def;
    },

    _clearList: function (lyrInfo) {
      if (!lyrInfo.isLoaded && lyrInfo.legendNode) {
        lyrInfo.isLoaded = false;
        lyrInfo.legendNode.innerHTML = '';
      }
    },

    _updateList: function (features, legendNode, node, fields, updateCount, lyrInfo, countOnly) {
      var li = lyrInfo.li ? lyrInfo.li : lyrInfo;
      //to fix the gitHub Ticekt #2
      if (!features) {
        return;
      }
      if (lyrInfo.type === 'ClusterLayer') {
        if (lyrInfo.layerObject.node) {
          if (domClass.contains(lyrInfo.layerObject.node.id, 'searching')) {
            domClass.remove(lyrInfo.layerObject.node.id, 'searching');
          }
        }
      }
      if (typeof(lyrInfo.visScaleRange) === "undefined") {
        lyrInfo.visScaleRange = this._inVisibleRange(lyrInfo.id || li.id);
      }

      var visScaleRange = lyrInfo.visScaleRange;
      var infoTemplate = lyrInfo.infoTemplate;
      var displayOptions = lyrInfo.symbolData ? lyrInfo.symbolData.featureDisplayOptions : (li && li.symbolData) ?
        li.symbolData.featureDisplayOptions : {};

      if (node || legendNode) {
        if (legendNode && (lyrInfo.hasOwnProperty('isLoaded') ? !lyrInfo.isLoaded : true)) {
          legendNode.innerHTML = '';
        }
        if (updateCount && node && this.config.countEnabled && (!this.showAllFeatures || !lyrInfo.isLoaded)) {
          if (visScaleRange) {
            node.innerHTML = utils.localizeNumber(features.length);
          } else {
            (function (node, legendNode, visScaleRange, features) {
              this.countFeatures(lyrInfo, lyrInfo.id || li.id).then(lang.hitch(this, function (lyrInfo) {
                var updateNode = this.config.countEnabled ? node.parentNode : legendNode.previousSibling;
                if ((lyrInfo.type === 'ClusterLayer' && lyrInfo.visible) || lyrInfo.type !== 'ClusterLayer') {
                  this.updateExpand(updateNode, visScaleRange ? features.length === 0 : true);
                }
              }));
            }).bind(this)(node, legendNode, visScaleRange, features);
          }
        }
        var updateNode = this.config.countEnabled && node ? node.parentNode : legendNode.previousSibling;
        if ((lyrInfo.type === 'ClusterLayer' && lyrInfo.visible) || lyrInfo.type !== 'ClusterLayer') {
          this.updateExpand(updateNode, visScaleRange ? features.length === 0 : true);
        }
      }
      if (countOnly) {
        return;
      }

      if (!lyrInfo.listDisabled && !lyrInfo.isLoaded) {
        if (features.length > 0) {
          var jimuLayerInfo = this.operLayerInfos.getLayerInfoById(lyrInfo.id);

          var renderer = (lyrInfo.type === "ClusterLayer") ? lyrInfo.layerObject.renderer : li.bypassDrawingInfo &&
            li.rendererJson && jsonUtil.fromJson(JSON.parse(li.rendererJson)) ?
            jsonUtil.fromJson(JSON.parse(li.rendererJson)) :
            (jimuLayerInfo && jimuLayerInfo.layerObject && jimuLayerInfo.layerObject.renderer) ?
              jimuLayerInfo.layerObject.renderer :
              features[0]._graphicsLayer ? features[0]._graphicsLayer.renderer :
                (lyrInfo.layerObject && lyrInfo.layerObject.renderer) ? lyrInfo.layerObject.renderer :
                  (li && li.renderer) ? jsonUtil.fromJson(li.renderer) || li.renderer :
                    lyrInfo.renderer ? jsonUtil.fromJson(lyrInfo.renderer) || lyrInfo.renderer : undefined;
          var _fields = (lyrInfo.li && lyrInfo.li.fields) ? lyrInfo.li.fields : lyrInfo.fields;

          var groupNodes = [];
          var finalGroupNodes = [];
          var finalDomNodes = [];
          for (var i = 0; i < features.length; i++) {
            var groupAdded = false;
            var feature = features[i];
            if (typeof (feature.infoTemplate) === 'undefined' && infoTemplate) {
              feature.infoTemplate = infoTemplate;
            }

            var symbol = (renderer && renderer.getSymbol) ? renderer.getSymbol(feature) :
              (feature.symbol) ? jsonUtils.fromJson(feature.symbol) : undefined;

            var oidName = (feature._layer && feature._layer.objectIdField) ? feature._layer.objectIdField :
              (li && li.oidFieldName && li.oidFieldName.name) ? li.oidFieldName.name :
                (lyrInfo.layerObject && lyrInfo.layerObject.objectIdField) ? lyrInfo.layerObject.objectIdField :
                  (lyrInfo && lyrInfo.oidFieldName) ? lyrInfo.oidFieldName : undefined;

            var id = oidName ? feature.attributes[oidName] : legendNode.id + i;

            var flds = (fields[0] === '*') ? feature.attributes : fields;
            var isNames = (fields[0] === '*') ? false : true;

            var displayStringObj = this.getDisplayString(feature, lyrInfo, flds, displayOptions, oidName, isNames);
            var displayString = displayStringObj.displayString;
            var aliasNames = displayStringObj.aliasNames;
            var firstValue = displayStringObj.firstValue;
            var groupField, groupNode, groupContainer, displayValue, groupType;
            if (displayOptions.groupEnabled) {
              var featureValue = undefined; // jshint ignore:line
              var _value = undefined; // jshint ignore:line
              var appendVal = undefined; // jshint ignore:line
              if (typeof (displayOptions.groupByField) === 'undefined' || displayOptions.groupByField) {
                groupField = displayOptions.groupField;
                featureValue = feature.attributes[groupField.name];
                groupType = 'byField';
                appendVal = featureValue;
              } else {
                groupField = displayOptions.groupByRendererOptions.fields[0];
                featureValue = feature.attributes[groupField.name];
                var groubByFields = displayOptions.groupByRendererOptions.fields;
                var groupByValues = displayOptions.groupByRendererOptions.values;
                groupType = 'byRenderer';

                if (featureValue !== null && featureValue !== "") {
                  expression_loop:
                  for (var ii = 0; ii < groupByValues.length; ii++) {
                    var _val = groupByValues[ii];
                    var exp = _val.value;
                    var expParts = exp.split("&&");
                    if (expParts && expParts.length > 1) {
                      exp = featureValue + expParts[0] + "&& " + featureValue + expParts[1];
                    } else {
                      exp = isNaN(featureValue) ? "'" + featureValue + "'" + _val.value : featureValue + _val.value;
                    }
                    if (eval(exp)) { // jshint ignore:line
                      _value = _val;
                      break expression_loop;
                    }
                  }
                  if (typeof (_value) !== 'undefined' && _value !== null) {
                    appendVal = _value.label.replace(/ /g, '');
                  }
                }
              }
              var gId = 'group_' + li.id + "_" + groupField.name + "_" + appendVal;
              var addGroup = true;
              var n;
              if (groupNodes.length > 0) {
                node_loop:
                for (var iii = 0; iii < groupNodes.length; iii++) {
                  var gNode = groupNodes[iii];
                  if (gId === gNode.id) {
                    if (groupType === 'byField' && featureValue === gNode.value || groupType === 'byRenderer') {
                      addGroup = false;
                      n = gNode.node;
                      groupContainer = gNode.parent;
                      break node_loop;
                    }
                  }
                }
              }
              if (addGroup) {
                groupAdded = true;
                groupContainer = domConstruct.create('div', {
                  'class': this.isDartTheme ? 'groupItem-dart' : 'groupItem',
                  id: gId + "_c"
                });
                var groupTitle = domConstruct.create('div', {
                  'class': this.isDartTheme ? 'groupItemTitle-dart' : 'groupItemTitle',
                  id: gId + "_t",
                  'attr-layerid': li.id,
                  "role": "button",
                  "tabindex": "0"
                }, groupContainer);
                var label = "";
                var title = groupType === 'byRenderer' ? "" : groupField.name + ": ";
                if (typeof (aliasNames) !== 'undefined') {
                  if (aliasNames.hasOwnProperty(groupField.name) && aliasNames[groupField.name] !== '') {
                    if (groupType === 'byField') {
                      title = aliasNames[groupField.name] + ": ";
                    } else {
                      title = "";
                    }
                  }
                }
                if (groupType === 'byField') {
                  if (typeof (groupField.label) !== 'undefined' && groupField.label !== "") {
                    label = groupField.label + ": ";
                    title = label;
                  }
                  if (label === ": ") {
                    label = "";
                    title = "";
                  }
                } else {
                  if (typeof (_value) !== 'undefined') {
                    if (typeof (_value.label) !== 'undefined' && _value.label !== "") {
                      label = title + _value.label;
                      title = label;
                    }
                  } else {
                    label = title + featureValue;
                    title = label;
                  }
                  if (label === ": ") {
                    label = "";
                    title = "";
                  }
                }

                displayValue = this._getFormattedValue(feature, groupField.name, lyrInfo, _fields);

                if (groupType === 'byRenderer' && symbol) {
                  this._createImageDataDiv(lang.clone(symbol), 30, 30, groupTitle, isCustom);
                }

                domConstruct.create('div', {
                  'class': groupType === 'byField' ? 'groupField' : 'groupFieldImage',
                  innerHTML: groupType === 'byField' ? label + displayValue : label,
                  title: groupType === 'byField' ? title + displayValue : title
                }, groupTitle);

                var inGrpList = false;
                if (lyrInfo.openGroups && lyrInfo.openGroups.length > 0) {
                  inGrpList = lyrInfo.openGroups.indexOf(gId) > -1;
                }
                var _append = this.isDartTheme ? ' darkThemeColor' : ' lightThemeColor';
                var groupCountNode = domConstruct.create('div', {
                  'class': this.isDartTheme ? 'groupCountLabel' : 'groupCountLabel' + _append
                }, groupTitle);

                var imageContainer = domConstruct.create('div', {
                  'class': (this.isDartTheme || (this.isDashboardTheme && !this.isLightTheme)) ?
                    'expandImageContainer-dart' : 'expandImageContainer'
                }, groupTitle);

                var gIIUp = this.isDartTheme ? "groupItemImageUp-dart" :
                  (this.isDashboardTheme && !this.isLightTheme) ?
                    "groupItemImageUp-dashboard" : "groupItemImageUp";
                var gIIDown = this.isDartTheme ? "groupItemImageDown-dart" :
                  (this.isDashboardTheme && !this.isLightTheme) ?
                    "groupItemImageDown-dashboard" : "groupItemImageDown";
                var cNames = this.isDartTheme ? 'groupItemImage-dart' :
                  (this.isDashboardTheme && !this.isLightTheme) ?
                    "groupItemImage-dashboard" : 'groupItemImage';
                cNames += inGrpList ? ' ' + gIIUp : ' ' + gIIDown;
                domConstruct.create('div', {
                  'class': cNames
                }, imageContainer);

                cNames = this.isDartTheme ? 'groupItem-dart' : 'groupItem';
                cNames += (lyrInfo.groupOpen && inGrpList) ? ' groupOn' : ' groupOff';
                groupNode = domConstruct.create('div', {
                  'class': cNames,
                  id: gId
                }, groupContainer);

                groupNodes.push({
                  id: 'group_' + li.id + "_" + groupField.name + "_" + appendVal,
                  node: groupNode,
                  parent: groupContainer,
                  value: featureValue
                });

                finalGroupNodes.push({
                  value: featureValue,
                  node: groupContainer,
                  countNode: groupCountNode,
                  count: 1
                });

                on(groupContainer, "click", lang.hitch(this, this._toggleGroup, lyrInfo));
                // code for accessibility: group accessibility handled
                on(groupTitle, "keydown", lang.hitch(this, function(evt) {
                  var parentID = domAttr.get(evt.currentTarget, 'attr-layerid');
                  var clusteringEnabled = this._getClusteringEnabledValue(parentID);
                  if(evt.keyCode === keys.SPACE || evt.keyCode === keys.ENTER) {
                    var gTID = evt.currentTarget.id;
                    var gCID = evt.currentTarget.parentNode.id;
                    dom.byId(gCID).click();
                    //Prevent the scrolling of panel when the SPACE key is pressed.
                    evt.preventDefault();

                  }
                  if (evt.keyCode === keys.ESCAPE) {
                    evt.stopPropagation();
                    evt.preventDefault();
                    var recId = "rec_" + parentID;
                    var recIconId = "recIcon_" + parentID;
                    var expandId = "exp_" + parentID;
                    if(clusteringEnabled && (parentID.lastIndexOf("_CL", parentID.length - 3) === -1)) {
                      recId = recId + "_CL";
                      recIconId = recIconId + "_CL";
                      expandId = expandId + "_CL";
                    }
                    domAttr.set(dom.byId(recIconId), "tabindex", -1);
                    domAttr.set(dom.byId(expandId), "tabindex", -1);
                    this._support508Accessibility();
                    focusUtil.focus(dom.byId(recId));
                  }
                }));
                var groupCntainerAriaLabel;
                if(groupType === 'byField') {
                  groupCntainerAriaLabel = label + displayValue;
                }
                else {
                  groupCntainerAriaLabel = label;
                }
                domAttr.set(groupTitle, "aria-label", groupCntainerAriaLabel);
              } else {
                var result = finalGroupNodes.filter(function (o) {
                  if (o.node.id === (n.id + "_c")) {
                    return o;
                  }
                });

                result[0].count += 1;
                groupNode = n;
              }
            }
            var featureItem = domConstruct.create('div', {
              'class': this.isDartTheme ? 'featureItem-dart' : 'featureItem',
              id: 'feature_' + li.id + "_" + id,
              'attr-layerid': li.id,
              role: 'button',
              tabindex: 0
            });

            var isCustom = false;
            if (li && li.symbolData) {
              isCustom = li.symbolData.symbolType === "CustomSymbol";
            }
            if (symbol) {
              if (displayOptions.groupEnabled && groupType === 'byRenderer') {
                //this._createImageDataDiv(lang.clone(symbol), 30, 30, groupTitle, isCustom);
              } else {
                this._createImageDataDiv(lang.clone(symbol), 30, 30, featureItem, isCustom);
              }
            }

            on(featureItem, "click", lang.hitch(this, this._panToFeature, feature, jimuLayerInfo, id));
            // code for accessibility : keydown event of featureItem
            on(featureItem, "keydown", lang.hitch(this, function (evt) {
              var parentID = domAttr.get(evt.currentTarget, 'attr-layerid');
              var clusteringEnabled = this._getClusteringEnabledValue(parentID);
              if (evt.keyCode === keys.ENTER || evt.keyCode === keys.SPACE) {
                evt.currentTarget.click();
                //Prevent the scrolling of panel when the SPACE key is pressed.
                evt.preventDefault();
              }
              if (evt.keyCode === keys.ESCAPE) {
                evt.stopPropagation();
                evt.preventDefault();
                var recId = "rec_" + parentID;
                var recIconId = "recIcon_" + parentID;
                var expandId = "exp_" + parentID;
                if(clusteringEnabled && (parentID.lastIndexOf("_CL", parentID.length - 3) === -1)) {
                  recId = recId + "_CL";
                  recIconId = recIconId + "_CL";
                  expandId = expandId + "_CL";
                }
                domAttr.set(dom.byId(recIconId), "tabindex", -1);
                domAttr.set(dom.byId(expandId), "tabindex", -1);
                this._support508Accessibility();
                focusUtil.focus(dom.byId(recId));
              }
            }));

            if (displayString.indexOf(" - ") > -1) {
              displayString = displayString.slice(0, -3);
            }
            domAttr.set(featureItem, 'aria-label', displayString);
            var _margin = displayOptions.groupEnabled && groupType === 'byRenderer' ? "15px" : "50px";
            var _txtAlign = window.isRTL ? "right" : "left";
            domConstruct.create('div', {
              style: "padding: 7px 5px 5px " + _margin + "; text-align: " + _txtAlign + ";",
              innerHTML: displayString,
              title: displayString
            }, featureItem);

            finalDomNodes.push({
              node: featureItem,
              updateNode: groupNode ? groupNode : legendNode,
              firstValue: firstValue
            });
          }

          if (finalGroupNodes.length > 0) {
            var sortFunction;
            var opts = displayOptions.groupByRendererOptions;
            if (displayOptions.groupByRenderer && opts && opts.values) {
              //for group by renderer sort based on same order defined by renderer
              var sortOrder = [];
              array.forEach(opts.values, function (v) {
                sortOrder.push(v.label);
              });
              sortFunction = function (a, b) {
                return sortOrder.indexOf(a.node.innerText) - sortOrder.indexOf(b.node.innerText);
              };
            } else {
              sortFunction = function (a, b) {
                if (typeof (a.value) === 'undefined') {
                  return b.value;
                } else if (typeof (b.value) === 'undefined') {
                  return a.value;
                }
                if (isNaN(a.value)) {
                  return a.value.localeCompare(b.value);
                } else {
                  return parseFloat(a.value) - parseFloat(b.value);
                }
              };
            }

            //sort and place at legendNode
            var nodes = finalGroupNodes.sort(sortFunction);
            var cE = this.config.countEnabled;
            //if confing has groupFeaturesSortOrder property and its value is DESC
            //then reverse array which is sorted in ASC order
            if (displayOptions && typeof (displayOptions.groupFeaturesSortOrder) !== undefined &&
              displayOptions.groupFeaturesSortOrder === "DESC") {
              nodes = nodes.reverse();
            }
            array.forEach(nodes, function (n) {
              if (cE) {
                n.countNode.innerHTML = utils.localizeNumber(n.count);
              }
              legendNode.appendChild(n.node);
            });
          }

          if (finalDomNodes.length > 0) {
            var sortedNodes = finalDomNodes.sort(function (a, b) {
              var _a = a.firstValue;
              var _b = b.firstValue;
              if (typeof (_a) === 'undefined' || _a === null || _a === "") {
                return 1;
              } else if (typeof (_b) === 'undefined' || _b === null || _b === "") {
                return -1;
              } else if (_a === _b) {
                return 0;
              }
              if (isNaN(_a)) {
                return _a.toString().localeCompare(_b.toString());
              } else {
                return parseFloat(_a) - parseFloat(_b);
              }
            });
            //if confing has layerOptionsSortOrder property and its value is DESC
            //then reverse array which is sorted in ASC order
            if (displayOptions && typeof (displayOptions.layerOptionsSortOrder) !== undefined &&
              displayOptions.layerOptionsSortOrder === "DESC") {
              sortedNodes = sortedNodes.reverse();
            }
            array.forEach(sortedNodes, function (fdn) {
              domConstruct.place(fdn.node, fdn.updateNode);
            });
          }
        }
      }
      if (!this.showAllFeatures || (this.showAllFeatures && visScaleRange)) {
        li.layerListExtentChanged = false;
      }

      var s_id = (lyrInfo.layerObject && lyrInfo.layerObject.id && lyrInfo.layerObject.id in this.layerList) ?
        lyrInfo.layerObject.id : li.id;
      if (this.showAllFeatures && lyrInfo.visible && visScaleRange) {
        var loaded = true;
        if (lyrInfo.layerObject && lyrInfo.type === 'ClusterLayer') {
          loaded = !lyrInfo.layerObject.queryPending;
          if (lyrInfo.layerObject.hasOwnProperty('requiresReload')) {
            loaded = loaded && !lyrInfo.layerObject.requiresReload;
            lyrInfo.layerObject.requiresReload = false;
          }
        }
        lyrInfo.isLoaded = loaded;
      }

      this._removeSearching(s_id, lyrInfo.legendOpen);
      this.initialOpen = false;
    },

    // code for accessibility : function to support infosummary accessible
    _support508Accessibility: function (focusFlag) {
      var layerNodeArray, firstActivelayerNode, flag, lyrInfo, layerId;
      flag = 1;
      layerNodeArray = query(".esriCTInfoLayer", this.domNode);
      //set tabindex -1 for inACtive layer nodes
      if (layerNodeArray.length) {
        layerNodeArray.forEach(lang.hitch(this, function (layerNode) {
          layerId = domAttr.get(layerNode, "attr-layerid");
          lyrInfo = this.operLayerInfos.getLayerInfoById(layerId);
          visible = lyrInfo.isShowInMap() && lyrInfo.isInScale();
          if (visible && flag) {
            firstActivelayerNode = layerNode;
            flag = 0;
          }
          if (!visible) {
            domAttr.set(layerNode, "tabindex", -1);
          }
        }));
        utils.initFirstFocusNode(this.domNode, firstActivelayerNode);
        if (!focusFlag) {
          focusUtil.focus(firstActivelayerNode);
        }
        this._updateLastNode();
      }
    },

    // code for accessibility : function to update last focus node
    _updateLastNode: function () {
      var layerNodeArray, lastNode, lastActiveLayerNodeId, lastLegendId, lastLegend,
      featureItemArray, featureItemArrayLen, groupItemArray, groupItemArrayLen, groupONOFFNode,
      lyrInfo, layerId, visible;
      layerNodeArray = query(".esriCTInfoLayer", this.domNode);
      if (layerNodeArray.length) {
        layerNodeArray.forEach(lang.hitch(this, function (layerNode) {
          layerId = domAttr.get(layerNode, "attr-layerid");
          lyrInfo = this.operLayerInfos.getLayerInfoById(layerId);
          visible = lyrInfo.isShowInMap() && lyrInfo.isInScale();
          if (visible) {
            lastNode = layerNode;
            lastActiveLayerNodeId = domAttr.get(layerNode, "attr-layerid");
          }
        }));
        if (lastNode) {
          utils.initLastFocusNode(this.domNode, lastNode);
          // check for feature list if open then set last feature ele as last focus node
          lastLegendId = ("legend_").concat(lastActiveLayerNodeId);
          lastLegend = dom.byId(lastLegendId);
          if (lastLegend) {
            if (domClass.contains(lastLegend, "legendOn")) {
              groupItemArray = query(".groupItemTitle" || ".groupItemTitle-dart", lastLegend);
              groupItemArrayLen = groupItemArray.length;
              if (groupItemArrayLen) {
                lastNode = groupItemArray[groupItemArrayLen - 1];
                utils.initLastFocusNode(this.domNode, lastNode);
                groupONOFFNode = lastNode.nextSibling;
                if(domClass.contains(groupONOFFNode, "groupOn")) {
                  featureItemArray = query(".featureItem" || ".featureItem-dart", lastLegend);
                  featureItemArrayLen = featureItemArray.length;
                  if (featureItemArrayLen) {
                    lastNode = featureItemArray[featureItemArrayLen - 1];
                    utils.initLastFocusNode(this.domNode, lastNode);
                  }
                }
              }
              else {
                featureItemArray = query(".featureItem" || ".featureItem-dart", lastLegend);
                featureItemArrayLen = featureItemArray.length;
                if (featureItemArrayLen) {
                  lastNode = featureItemArray[featureItemArrayLen - 1];
                  utils.initLastFocusNode(this.domNode, lastNode);
                }
              }
            }
          }
        }
      }
    },

    updateExpand: function (node, hide) {
      if (typeof (node) !== 'undefined') {
        var id;
        var en;
        if (node.id.indexOf('rec_') > -1) {
          id = node.id.replace('rec_', '');
          en = dom.byId("exp_" + id);
        }

        if (hide) {
          if (node) {
            html.addClass(node, "recDefault");
            var subNode = dom.byId("recIcon_" + id);
            if ((subNode && domClass.contains(subNode, 'sub-active')) || !subNode ) {
              html.addClass(node, "inActive");
            }
          }
          if (en) {
            if (!domClass.contains(en, 'expand-empty')) {
              html.addClass(en, "expandInActive");
            }
          }
        } else {
          if (node) {
            html.removeClass(node, "recDefault");
            html.removeClass(node, "inActive");
          }
          if (en) {
            if (!domClass.contains(en, 'expand-empty')) {
              html.removeClass(en, "expandInActive");
            }
          }
        }
      }
    },

    getDisplayString: function (feature, lyrInfo, fields, displayOptions, oidName, isNames) {
      var displayString = "";
      var aliasNames = {};
      var firstValue = "";
      if (displayOptions.fields.length > 0) {
        //get the layer fields
        var _fields = (lyrInfo.li && lyrInfo.li.fields) ? lyrInfo.li.fields : lyrInfo.fields;
        array.forEach(displayOptions.fields, lang.hitch(this, function (displayField) {
          for (var a in fields) {
            var fieldName = isNames ? fields[a] : a;
            if (fieldName === displayField.name) {

              //get the value with proper formatting
              var featureValue = this._getFormattedValue(feature, fieldName, lyrInfo, _fields);
              var rawValue = this._getRawFeatureValue(feature, fieldName);
              //set the alias name
              aliasNames[fieldName] = this._checkAliasName(_fields, fieldName);

              firstValue = firstValue === "" ? rawValue : firstValue;
              var hasLabel = typeof(displayField.label) !== 'undefined';
              var append = hasLabel ? displayField.label.trim() === "" ? "" : ": " : "";
              var label = hasLabel ? displayField.label : "";

              displayString += label + append + featureValue + " - ";
              break;
            }
          }
        }));
      }
      return {
        displayString: displayString,
        aliasNames: aliasNames,
        firstValue: firstValue
      };
    },
    _getRawFeatureValue: function (feature, fieldName) {
      //get raw feature value
      var v = feature.attributes[fieldName];
      var featureValue = (typeof (v) === 'undefined' || v === null) ? '' : v;
      return featureValue;
    },

    _getFormattedValue: function(feature, fieldName, lyrInfo, fields){
      //get raw feature value
      var v = feature.attributes[fieldName];
      var featureValue = (typeof (v) === 'undefined' || v === null) ? '' : v;

      //get the fieldInfos
      var fieldInfos;
      var infoTemplate = this._getInfoTemplate(lyrInfo);
      if(infoTemplate) {
        if (infoTemplate.info && infoTemplate.info.fieldInfos) {
          fieldInfos = infoTemplate.info.fieldInfos;
        } else if(infoTemplate._fieldsMap){
          fieldInfos = infoTemplate._fieldsMap;
        }
      }
      //get fieldInfo and field
      var fieldInfo;
      if (fieldInfos && Array.isArray(fieldInfos) && fieldInfos.hasOwnProperty('length')) {
        fieldInfo = this._getFieldByName(fieldInfos, fieldName);
      }
      var field = this._getFieldByName(fields, fieldName);
      if (field) {
        var intField = this._checkIntField(field);
        var domainField = lyrInfo.type === "ClusterLayer" ? false : this._checkDomainField(field); //keeping this as failover in case I am not fully considering something about the new util function
        var subtype = lyrInfo.type === "ClusterLayer" ? false :
          this._checkDomainAndSubtype(lyrInfo.layerDefinition, fieldName, feature.attributes, lyrInfo);
        var dateField = this._checkDateField(field);

        featureValue = dateField ? this.formatDateValue(featureValue, fieldInfo) :
          (domainField || subtype) ? this.formatDomainValue(featureValue, domainField, subtype) :
            intField ? this.formatNumberValue(featureValue, fieldInfo) : featureValue;
      }
      return featureValue;
    },

    _getFieldByName: function (fields, fieldName) {
      if (fields) {
        var _fields = fields.filter(function (f) {
          return f.name === fieldName || f.fieldName === fieldName ||
          (fields.hasOwnProperty(f) && fields[f].fieldName === fieldName);
        });
        if (_fields && _fields.length > 0) {
          return _fields[0];
        }
      }
      return undefined;
    },

    _getInfoTemplate: function (lyrInfo) {
      var infoTemplate = lyrInfo.infoTemplate;
      if (!infoTemplate) {
        if (lyrInfo.layerObject && lyrInfo.layerObject.infoTemplate) {
          infoTemplate = lyrInfo.layerObject.infoTemplate;
        } else if (lyrInfo.li && lyrInfo.li.infoTemplate) {
          infoTemplate = lyrInfo.li.infoTemplate;
        }
      }
      if (!infoTemplate) {
        if (typeof (lyrInfo.li.subLayerId) !== 'undefined') {
          var infoTemplates = lyrInfo.layerObject.infoTemplates;
          if (infoTemplates && infoTemplates.hasOwnProperty(lyrInfo.li.subLayerId)) {
            infoTemplate = infoTemplates[lyrInfo.li.subLayerId].infoTemplate;
          }
        }
      }
      return infoTemplate;
    },

    formatNumberValue: function(v, fieldInfo){
      var num = v;
      if(!isNaN(v) && v !== ""){
        var options = (fieldInfo && fieldInfo.format) ? fieldInfo : undefined;
        num = utils.localizeNumberByFieldInfo(v, options);
      }
      return num || "";
    },

    formatDomainValue: function (v, domain, subtype) {
      if (subtype) {
        return subtype;
      }

      if (domain && domain.codedValues) {
        var cvs = domain.codedValues;
        for (var i = 0; i < cvs.length; i++) {
          var cv = cvs[i];
          if (cv.code === v || cv.name == v) {
            return cv.name;
          }
        }
      }
      return domain.type === "range" ? v : undefined;
    },

    formatDateValue: function (v, fieldInfo) {
      if (v) {
        var options = (fieldInfo && fieldInfo.format) ? fieldInfo : undefined;
        var d = new Date(parseInt(v, 10));
        return options ? utils.localizeDateByFieldInfo(d, options) : utils.localizeDate(d);
      } else {
        return "";
      }
    },

    _checkAliasName: function (field) {
      return typeof (field.alias) !== 'undefined' ? field.alias : false;
    },

    _checkDomainField: function (field) {
      return typeof (field.domain) !== 'undefined' ? field.domain : false;
    },

    _checkDomainAndSubtype: function(layerDefinition, fieldName, attributes, lyrInfo) {
      var result;
      if (layerDefinition && fieldName && attributes) {
        var lyr = lyrInfo.layerObject && lyrInfo.layerObject.renderer ? lyrInfo.layerObject : layerDefinition;
        result = utils.getDisplayValueForCodedValueOrSubtype(lyr, fieldName, attributes);
        if (result && result.isCodedValueOrSubtype && typeof (result.displayValue) !== 'undefined') {
          return result.displayValue;
        }
      }
      return false;
    },

    _checkDateField: function(field){
      return field.type === 'esriFieldTypeDate';
    },

    _checkIntField: function(field){
      var testTypes = ['esriFieldTypeSmallInteger', 'esriFieldTypeInteger',
      'esriFieldTypeSingle', 'esriFieldTypeDouble'];
      return testTypes.indexOf(field.type) > -1;
    },

    _checkDisplayField: function(displayFields, featureField){
      var includeField = true;
      if (displayFields) {
        for (var j = 0; j < displayFields.length; j++) {
          if (displayFields[j].name === featureField) {
            return displayFields[j];
          } else {
            includeField = false;
          }
        }
      }
      return includeField;
    },

    flashGraphics: function (graphics) {
      for (var i = 0; i < graphics.length; i++) {
        var g = graphics[i];
        this._flashFeature(g);
      }
    },

    _flashFeature: function (feature) {
      var symbol;
      if (feature.geometry) {
        var color = Color.fromHex(this._styleColor);
        var color2 = lang.clone(color);
        color2.a = 0.4;
        switch (feature.geometry.type) {
          case 'point':
            symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 15,
              new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
              color, 1),
              color2);
            break;
          case 'polyline':
            symbol = new SimpleLineSymbol(
              SimpleLineSymbol.STYLE_SOLID,
              color,
              3
            );
            break;
          case 'polygon':
            symbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_DIAGONAL_CROSS,
              new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
              color, 2), color2
            );
            break;
        }
      }

      var g = new Graphic(feature.geometry, symbol);
      this.map.graphics.add(g);
      var dShape = g.getDojoShape();
      if (dShape) {
        fx.animateStroke({
          shape: dShape,
          duration: 900,
          color: {
            start: dShape.strokeStyle.color,
            end: dShape.strokeStyle.color
          },
          width: {
            start: 25,
            end: 0
          }
        }).play();
        setTimeout(this._clearFeature, 1075, g);
      }
    },

    _clearFeature: function (f) {
      var gl = f.getLayer();
      gl.remove(f);
    },

    _panToFeature: function (feature, jimuLayerInfo, oid) {
      if (feature.geometry) {
        var geom = feature.geometry;
        if (geom.type === 'polyline') {
          var path = geom.paths[Math.ceil(geom.paths.length / 2) - 1];
          var g = path[Math.ceil((path.length - 1) / 2)];
          geom = new Point(g[0], g[1], geom.spatialReference);
        }
        if (geom.type !== 'point') {
          geom = geom.getExtent().getCenter();
        }
        this._pan(feature, geom).then(lang.hitch(this, function () {
          this._flashFeature(feature);
          var def = this._getMapLayerFeatureDef(feature, oid, jimuLayerInfo);
          def.then(lang.hitch(this, function (r) {
            var infoTemplateFeature = r && r.features && r.features.length > 0 ? r.features[0] : feature;
            if ((infoTemplateFeature._layer && infoTemplateFeature._layer.infoTemplate) || infoTemplateFeature.infoTemplate) {
              this.map.infoWindow.setFeatures([infoTemplateFeature]);
              this.map.infoWindow.select(0);
              this.map.infoWindow.show(geom);
            }
          }));
        }));
      }
    },

    _getMapLayerFeatureDef: function(queryTaskFeature, oid, jimuLayerInfo) {
      var q = new Query();
      q.outFields = queryTaskFeature.fields || ["*"];
      q.objectIds = [oid];
      q.returnGeometry = false;

      var layer = jimuLayerInfo.layerObject;
      return parseInt(oid, 10) > -1 && layer && layer.queryFeatures ? layer.queryFeatures(q) : Promise.resolve();
    },

    _pan: function (feature, centerPoint) {
      var def = new Deferred();
      if (this.showAllFeatures && !this.map.extent.contains(feature.geometry)) {
        this.map.centerAt(centerPoint).then(function (ext) {
          def.resolve(ext);
        });
      } else {
        def.resolve(undefined);
      }
      return def;
    },

    _getQuery: function (layerListLayer, fields, needsGeom) {
      var layerObject = layerListLayer.layerObject;
      var q = new Query();
      q.geometry = !this.showAllFeatures ? this.map.extent : null;
      q.outFields = fields;
      q.outSpatialReference = this.map.spatialReference;
      q.returnGeometry = needsGeom;
      var collectionTypes = ['collection', 'kml', 'geo_rss'];
      var isCollection = layerListLayer.selfType ? collectionTypes.indexOf(layerListLayer.selfType) > -1 :  false;
      //layer types from feature collection don't support where
      if (!isCollection && layerObject.url) {
        q.where = layerListLayer.filter ? layerListLayer.filter : "1=1";
      } else if (this.showAllFeatures && layerObject && layerObject.fullExtent) {
        //still need a way to support showing of all features
        q.geometry = layerObject.fullExtent;
      }
      return q;
    },

    _queryWFS: function (graphics) {
      //return graphics.filter(g => this.map.extent.intersects(g.geometry));
      return graphics.filter(lang.hitch(this, function (g) {
        return this.map.extent.intersects(g.geometry);
      }));
    },

    countFeatures: function (layerListLayer) {
      var def = new Deferred();
      if (!this.hidePanel) {
        var lyr = layerListLayer.layerObject;
        var visible = typeof (layerListLayer.visible) !== 'undefined' ? layerListLayer.visible : lyr.visible;
        var visScaleRange = layerListLayer.visScaleRange;
        var node = this.config.countEnabled ? layerListLayer.node : layerListLayer.legendNode;
        var q = this._getQuery(layerListLayer);
        if (lyr.queryCount && lyr.visible) {
          (function (layerListLayer) {
            lyr.queryCount(q, lang.hitch(this, function (r) {
              if (node) {
                var updateNode;
                if (this.config.countEnabled) {
                  node.innerHTML = utils.localizeNumber(r);
                  updateNode = node.parentNode;
                } else {
                  updateNode = node.previousSibling;
                }
                this.updateExpand(updateNode, visScaleRange ? r === 0 : true);
              }
              def.resolve(layerListLayer);
            }));
          }).bind(this)(layerListLayer);
        } else if (layerListLayer && layerListLayer.li && layerListLayer.li.url && visible &&
          ((layerListLayer.li.url.indexOf("MapServer") > -1 || layerListLayer.li.url.indexOf("FeatureServer") > -1) &&
            layerListLayer.li.url.indexOf("WFSServer") === -1)) {
          (function (layerListLayer) {
            var url = layerListLayer.li.url;
            var qt = new QueryTask(url);
            qt.executeForIds(q).then(lang.hitch(this, function (ids) {
              if (node) {
                var updateNode;
                var length = ids ? ids.length : 0;
                if (this.config.countEnabled) {
                  node.innerHTML = utils.localizeNumber(length);
                  updateNode = node.parentNode;
                } else {
                  updateNode = node.previousSibling;
                }
                this.updateExpand(updateNode, visScaleRange ? length === 0 : true);
              }
              def.resolve(layerListLayer);
            }));
          }).bind(this)(layerListLayer);
        } else if (visible && (layerListLayer.type === 'WFSLayer' ||
          (layerListLayer.li && layerListLayer.li.url && layerListLayer.li.url.indexOf("WFSServer") > -1))) {
          if (node) {
            var updateNode;
            var _graphics = this._queryWFS(lyr && lyr.graphics ? lyr.graphics : []);
            var _cnt = _graphics.length;
            if (this.config.countEnabled) {
              node.innerHTML = utils.localizeNumber(_cnt);
              updateNode = node.parentNode;
            } else {
              updateNode = node.previousSibling;
            }
            this.updateExpand(updateNode, visScaleRange ? _cnt === 0 : true);
            def.resolve(layerListLayer);
          }
        } else {
          def.resolve(layerListLayer);
        }
      } else {
        def.resolve(layerListLayer);
      }
      return def;
    }
  });
});