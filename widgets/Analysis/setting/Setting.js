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
/**
 * Analysis widget setting content.
 * @module widgets/Analysis/setting/Setting
 */
define([
    'dojo/_base/declare',
    'dojo/_base/array',
    'dojo/_base/lang',
    'dojo/_base/event',
    'dojo/query',
    'dojo/on',
    'dojo/fx',
    'dojo/dom',
    'dojo/dom-class',
    'dojo/dom-style',
    'dojo/dom-construct',
    'dojo/dom-prop',
    'dojo/i18n!esri/nls/jsapi',
    'dijit/_WidgetsInTemplateMixin',
    'jimu/BaseWidgetSetting',
    'jimu/utils',
    'jimu/portalUrlUtils',
    'jimu/portalUtils',
    'jimu/dijit/CheckBox',
    '../toolSettings',
    './SingleToolSetting'
  ],
  function(
    declare, array, lang, Event, query, on, coreFx, dom, domClass, domStyle, domConstruct, domProp,
    jsapiBundle, _WidgetsInTemplateMixin, BaseWidgetSetting, utils, portalUrlUtils, portalUtils, CheckBox, toolSettings,
    SingleToolSetting) {
    return /** @alias module:widgets/Analysis/setting/Setting */ declare([
        BaseWidgetSetting, _WidgetsInTemplateMixin], {
      //these two properties is defined in the BaseWidget
      baseClass: 'jimu-widget-analysis-setting',

      postMixInProperties: function(){
        this.inherited(arguments);
        lang.mixin(this.nls, jsapiBundle.analysisTools);
        lang.mixin(this.nls, window.jimuNls.common);
      },

      postCreate: function() {
        this.inherited(arguments);

        this.checkboxList = [];
        this._initToolsData();

        var portalUrl = portalUrlUtils.getStandardPortalUrl(this.appConfig.portalUrl);
        var portal = portalUtils.getPortal(portalUrl);
        var isOnline = portalUrlUtils.isOnline(portalUrl);
        var livingAtlasConfigEnabled = isOnline ? true : (portal.livingAtlasGroupQuery && portal.livingAtlasGroupQuery.length > 0);

        if(window.isRTL){
          this.infoString = this.rowsData.length + '/0';
          this.infoRegex = /\d+$/;
        }else{
          this.infoString = '0/' + this.rowsData.length;
          this.infoRegex = /^\d+/;
        }

        this.checkAllBtn = new CheckBox({});
        this.checkAllBtn.placeAt(this.checkAllBtnDiv);
        this.own(on(this.checkAllBtn.domNode, 'click', lang.hitch(this, function() {
          this._checkAll(this.checkAllBtn.getValue());
        })));

        array.forEach(this.rowsData, lang.hitch(this, function(row){
          this._addRow(row, livingAtlasConfigEnabled);
        }));
        domProp.set(this.infoText, 'innerHTML', utils.stripHTML(this.infoString.replace(this.infoRegex, 0)));

        if(this.config){
          this.setConfig(this.config);
        }

        this.own(on(document.body, 'click', lang.hitch(this, function(event) {
          var target = event.target || event.srcElement, isInternal;
          query('tr.setting', this.tbody).forEach(function(tr){
            isInternal = (target === tr) || dom.isDescendant(target, tr);
            if(!isInternal) {
              //hide the tool setting
              if(tr.show){
                coreFx.wipeOut({
                  node: tr.toolSetting.domNode
                }).play();
                tr.show = false;
              }
            }
          }, this);
        })));
      },

      /**
       * Add a row to analysis dijit tool table.
       * @param {Object} rowData Config of analysis dijit tool
       */
      _addRow: function(rowData, livingAtlasConfigEnabled){
        var toolName = rowData.name;
        //TODO: temporary fix
        if(rowData.title === 'chooseBestFacilities') {
          this.nls[rowData.title] = this.nls.chooseBestFacilities;
          this.nls[rowData.usage] = this.nls.chooseBestFacilities;
        }

        var tr = domConstruct.create("tr", {
          'class': 'tools-table-tr',
          title: this.nls[rowData.title]
        }, this.tbody);

        tr.rowData = rowData;
        //create checkbox
        var chkTd = domConstruct.create("td", {'class': 'checkbox-td'}, tr);
        var chkBox = new CheckBox({
          checked: false,
          // label: this.nls[rowData.title],
          rid: rowData.id
        });
        chkBox.placeAt(chkTd);
        this.checkboxList.push(chkBox);

        this.own(on(chkBox, 'change', lang.hitch(this, function(b){
          if(b){
            domClass.add(tr, 'selected');
          } else {
            domClass.remove(tr, 'selected');
          }
          this._updateInfoString();
        })));
        this.own(on(chkBox.domNode, 'click', lang.hitch(this, function(event){
          event.stopPropagation();
        })));

        //create name
        domConstruct.create("td", {
          innerHTML: utils.stripHTML(this.nls[rowData.title]),
          'class':'name-td'
        }, tr);
        //setting icon
        var settingIconTd = domConstruct.create("td", {'class': 'setting-td'}, tr);
        var settingImg = domConstruct.create('img', {
          src: this.folderUrl + 'images/setting.png',
          title: this.nls.toolSetting,
          'class': 'setting-icon'
        }, settingIconTd);
        //create img
        var imgTd = domConstruct.create("td", {'class': 'img-td'}, tr);
        domConstruct.create('img', {src: this.folderUrl + rowData.imgDisplay}, imgTd);
        //create usage
        domConstruct.create("td", {
          innerHTML: utils.stripHTML(this.nls[rowData.usage]),
          'class':'usage-td'},
        tr);

        //create tool setting
        var settingTr = domConstruct.create("tr", {
          'class': 'setting',
          'data-toolname': toolName
        }, this.tbody);
        var settingTd = domConstruct.create("td", {
          colspan: 5
        }, settingTr);
        var toolSetting = new SingleToolSetting({
          toolLabel: this.nls[rowData.title],
          rowData: rowData,
          nls: this.nls,
          appConfig: this.appConfig,
          livingAtlasConfigEnabled: livingAtlasConfigEnabled
        });
        domStyle.set(toolSetting.domNode, 'display', 'none');
        toolSetting.placeAt(settingTd);
        settingTr.toolSetting = toolSetting;
        settingTr.show = false;

        this.own(on(settingImg, 'click', lang.hitch(this, function(evt){
          Event.stop(evt);

          this._toggleToolSetting(settingTr);

          query('tr.setting', this.tbody).forEach(function(targetTr){
            if(targetTr.show && targetTr !== settingTr){
              coreFx.wipeOut({
                node: targetTr.toolSetting.domNode
              }).play();
              targetTr.show = false;
            }
          }, this);
        })));

        this.own(on(tr, 'click', lang.hitch(this, function(evt){
          Event.stop(evt);

          this._toggleSelected(tr);

          query('tr.setting', this.tbody).forEach(function(targetTr){
            if(targetTr.show && targetTr.toolSetting.rowData.id !== tr.rowData.id){
              coreFx.wipeOut({
                node: targetTr.toolSetting.domNode
              }).play();
              targetTr.show = false;
            }
          }, this);
        })));
      },

      _toggleToolSetting: function(tr){
        if(tr.show){
          coreFx.wipeOut({
            node: tr.toolSetting.domNode
          }).play();
          tr.show = false;
        }else{
          coreFx.wipeIn({
            node: tr.toolSetting.domNode
          }).play();
          tr.show = true;
        }
      },

      /**
       * Make all analysis tools selected.
       */
      _checkAll: function(checked){
        if(checked){
          //select all
          query('tr.tools-table-tr', this.tbody).forEach(function(trDom){
            //Will not re-apply duplicate classes.
            domClass.add(trDom, 'selected');
          });
          array.forEach(this.checkboxList, function(item){
            item.setValue(true);
          });
          this._updateInfoString();
        }else{
          //unselect all
          query('tr.tools-table-tr', this.tbody).forEach(lang.hitch(this, function(trDom){
            domClass.remove(trDom, 'selected');
          }));
          array.forEach(this.checkboxList, function(item){
            item.setValue(false);
          });

          domProp.set(this.infoText, 'innerHTML', utils.stripHTML(this.infoString.replace(this.infoRegex, 0)));
        }
      },

      _toggleCheckAll: function() {
        var value = !this.checkAllBtn.getValue();
        this.checkAllBtn.setValue(value);
        this._checkAll(value);
      },

      /**
       * Toggle selection of a table row.
       * @param  {Object} trDom The dom of a table row.
       */
      _toggleSelected: function(trDom){
        domClass.toggle(trDom, 'selected');
        var chkBox = this.getCheckboxById(trDom.rowData.id);
        if(chkBox){
          chkBox.setValue(domClass.contains(trDom, 'selected'));
        }
        this._updateInfoString();
      },

      /**
       * Update the info string of analysis dijit tools. [selected]/[all]
       */
      _updateInfoString: function(){
        var selectedItems = query('tr.selected', this.tbody).length;
        domProp.set(this.infoText, 'innerHTML',
          utils.stripHTML(this.infoString.replace(this.infoRegex, selectedItems)));
        if(selectedItems === this.rowsData.length){
          this.checkAllBtn.setValue(true);
        }else{
          this.checkAllBtn.setValue(false);
        }
      },

      /**
       * Set tool state based the param passed in.
       * @param {object} toolConfig Configuration of the analysis dijit tool.
       * @param {bool} selected
       */
      _setSelected: function(toolConfig, selected){
        var rowData = toolSettings.findToolSetting(toolConfig.name);
        if(rowData !== null){
          query('tr.tools-table-tr', this.tbody).some(lang.hitch(this, function(trDom){
            if(trDom.rowData.dijitID === rowData.dijitID){
              var chkBox = this.getCheckboxById(rowData.id);
              if(chkBox){
                chkBox.setValue(selected);
              }
              if(selected === true){
                domClass.add(trDom, 'selected');
              }else{
                domClass.remove(trDom, 'selected');
              }

              //set tool setting
              var settingTr = query('tr.setting[data-toolname=' + toolConfig.name + ']', this.tbody)[0];
              if(settingTr){
                var toolSetting = settingTr.toolSetting;
                if(toolSetting){
                  toolSetting.setConfig(toolConfig);
                }
              }

              return true;
            }
          }));
        }
      },

      /**
       * Set the configuration of analysis widget.
       * @param {Object} config
       */
      setConfig: function(config) {
        this.config = config;

        array.forEach(this.config.analysisTools, lang.hitch(this, function(item){
          this._setSelected(item, true);
        }));

        this._updateInfoString();
      },

      /**
       * Get the configuration of analysis widget.
       * @return {Object} The selected tool names.
       */
      getConfig: function() {
        var config = {
          analysisTools:[]
        };

        array.forEach(this.checkboxList, lang.hitch(this, function(item){
          if(item.getValue() === true){
            var rowData = this.getRowById(item.get('rid'));
            var toolName = rowData.name;
            if(toolName !== null){
              var toolItem = {
                name: toolName
              };
              var settingTr = query('tr.setting[data-toolname=' + toolName + ']', this.tbody)[0];
              var toolSetting = settingTr.toolSetting;

              if(toolSetting){
                lang.mixin(toolItem, toolSetting.getConfig());
              }

              config.analysisTools.push(toolItem);
            }else{
              console.warn('error find rowsData: ' + item.get('title'));
            }
          }
        }));

        return config;
      },

      /**
       * Init the analysis tool table.
       */
      _initToolsData: function(){
        var portalUrl = portalUrlUtils.getStandardPortalUrl(this.appConfig.portalUrl);
        var isPortal = !portalUrlUtils.isOnline(portalUrl);
        this.rowsData = toolSettings.getAllSettings(isPortal).sort(lang.hitch(this, function(a, b) {
          return ('' + this.nls[a.title]).localeCompare('' + this.nls[b.title]);
        }));
      },

      getRowById: function(rid) {
        var result;
        array.some(this.rowsData, lang.hitch(this, function(row) {
          if (row.id === rid) {
            result = row;
            return true;
          }
        }));
        return result;
      },

      getCheckboxById: function(rid) {
        var result;
        array.some(this.checkboxList, lang.hitch(this, function(item) {
          if (item.rid === rid) {
            result = item;
            return true;
          }
        }));
        return result;
      }
    });
  });
