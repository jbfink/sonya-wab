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
 * Single Analysis tool setting section.
 * @module widgets/Analysis/setting/SingleToolSetting
 */
define(['dojo/_base/declare',
  'dojo/text!./SingleToolSetting.html',
  'dojo/dom-style',
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  'dijit/_WidgetsInTemplateMixin',
  'jimu/portalUrlUtils',
  'jimu/dijit/CheckBox',
  'dijit/form/ValidationTextBox'
  ], function(declare, template, domStyle, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin,
  portalUrlUtils, CheckBox){
  return /** @alias module: widgets/Analysis/setting/SingleToolSetting*/ declare([_WidgetBase,
      _TemplatedMixin, _WidgetsInTemplateMixin], {
    baseClass: 'jimu-widget-analysis-singleToolSetting',
    templateString: template,

    toolLabel: null,
    nls: null,
    /**
     * Analysis tool config. Include these options:
     * {
     *   toolLabel: '',
     *   showHelp: true,
     *   showChooseExtent: true,
     *   showCredits: true,
     *   returnFeatureCollection: true //If tool is Extract Data, this option will be removed.
     * }
     * @type {[type]}
     */
    config: null,
    /**
     * Analysis tool settings. Include dijitID, analysisLayer, etc.
     * @type {object}
     */
    rowData: null,

    livingAtlasConfigEnabled: false,

    postCreate: function(){
      this.inherited(arguments);

      this.labelEditor.set('value', this.toolLabel);

      if(this.rowData.title === 'extractData'){
        domStyle.set(this.resultOption, 'display', 'none');
      }

      if(this.rowData.title !== 'planRoutes' && this.rowData.title !== 'findNearest' &&
        this.rowData.title !== 'connectOriginsToDestinations'){
        domStyle.set(this.showOutputTypeOption, 'display', 'none');
      }

      this.helptipChk = new CheckBox({
        checked:true,
        label: this.nls.showHelpTip
      });
      this.helptipChk.placeAt(this.helpTipOption);

      this.mapExtentChk = new CheckBox({
        checked: true,
        label: this.nls.showCurrentMapExtent
      });
      this.mapExtentChk.placeAt(this.mapExtentOption);

      this.creditsChk = new CheckBox({
        checked: true,
        label: this.nls.showCredits
      });
      this.creditsChk.placeAt(this.creditsOption);

      this.resultChk = new CheckBox({
        checked: true,
        label: this.nls.saveAsFeatureService
      });
      this.resultChk.placeAt(this.resultOption);

      if (this.livingAtlasConfigEnabled) {
        this.readyToUseLayersChk = new CheckBox({
          checked: true,
          label: this.nls.showReadyToUseLayers
        });
        this.readyToUseLayersChk.placeAt(this.readyToUseLayersOption);
        domStyle.set(this.readyToUseLayersOption, 'display', 'block');
      } else {
        domStyle.set(this.readyToUseLayersOption, 'display', 'none');
      }

      this.allowToExportChk = new CheckBox({
        checked: false,
        label: this.nls.allowToExport
      });
      this.allowToExportChk.placeAt(this.allowToExportOption);

      this.showOutputTypeChk = new CheckBox({
        checked: false,
        label: this.nls.includeRouteLayer
      });
      this.showOutputTypeChk.placeAt(this.showOutputTypeOption);

      //Living Atlas Analysis Layer is not available in portal 10.4. Hide this option.
      var portalUrl = portalUrlUtils.getStandardPortalUrl(this.appConfig.portalUrl);
      if(!portalUrlUtils.isOnline(portalUrl) ||
        ['createViewshed', 'createWatershed', 'traceDownstream'].indexOf(this.rowData.title) >= 0){
        //Credits is not available in portal
        domStyle.set(this.creditsOption, 'display', 'none');
        this.creditsChk.setValue(false);
      }

      if(this.rowData.title === 'geocodeLocations'){
        domStyle.set(this.mapExtentOption, 'display', 'none');
        this.mapExtentChk.setValue(false);
        domStyle.set(this.resultOption, 'display', 'none');
        this.resultChk.setValue(false);
      }
    },

    getConfig: function(){
      var ret = {
        showHelp: this.helptipChk.getValue(),
        showCredits: this.creditsChk.getValue(),
        showChooseExtent: this.mapExtentChk.getValue(),
        showReadyToUseLayers: this.livingAtlasConfigEnabled ? this.readyToUseLayersChk.getValue() : false,
        allowToExport: this.allowToExportChk.getValue()
      };

      if(this.rowData.title !== 'extractData'){
        ret.returnFeatureCollection = !this.resultChk.getValue();
      }
      if(this.rowData.title === 'planRoutes' || this.rowData.title === 'findNearest' ||
        this.rowData.title === 'connectOriginsToDestinations'){
        ret.showOutputType = this.showOutputTypeChk.getValue();
      }

      if(this.labelEditor.validate()){
        var newLabel = this.labelEditor.get('value');
        // Save the label in config only if it is different from the default tool name
        if (newLabel !== this.toolLabel) {
          ret.toolLabel = newLabel;
        }
      }

      return ret;
    },

    setConfig: function(config){
      this.config = config;

      if (config.toolLabel) {
        this.labelEditor.set('value', config.toolLabel);
      }
      this.helptipChk.setValue(Boolean(config.showHelp));
      this.creditsChk.setValue(Boolean(config.showCredits));
      this.mapExtentChk.setValue(Boolean(config.showChooseExtent));
      if (this.livingAtlasConfigEnabled) {
        this.readyToUseLayersChk.setValue(Boolean(config.showReadyToUseLayers));
      }
      this.allowToExportChk.setValue(Boolean(config.allowToExport));

      if('returnFeatureCollection' in config){
        this.resultChk.setValue(!Boolean(config.returnFeatureCollection));
      }

      if('showOutputType' in config) {
        this.showOutputTypeChk.setValue(Boolean(config.showOutputType));
      }
    }
  });
});
