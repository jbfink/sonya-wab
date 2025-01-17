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
  'dojo/date/locale',
  'dojo/number',
  'esri/lang',
  'dojo/data/ItemFileWriteStore',
  'jimu/utils',
  'moment/moment'
],
function(declare, lang, array, locale, dojoNumber, esriLang, ItemFileWriteStore, jimuUtils, moment) {

  //refer arcgisonline/sharing/dijit/dialog/FilterDlg.js
  var clazz = declare([], {
    _stringFieldType: 'esriFieldTypeString',
    _dateFieldType: 'esriFieldTypeDate',
    _numberFieldTypes: ['esriFieldTypeOID',
                        'esriFieldTypeSmallInteger',
                        'esriFieldTypeInteger',
                        'esriFieldTypeSingle',
                        'esriFieldTypeDouble'],
    _supportFieldTypes: [],

    dayInMS : 24 * 60 * 60 * 1000,// 1 day
    HourInMS: 60 * 60 * 1000,// 1 hour
    MinuteInMS : 60 * 1000,// 1 minute
    SecInMS : 1000,// 1 second

    fieldsStore: null,
    isHosted: false,//indicate it is a hosted rest service or not

    //methods renamed:
    //parseDefinitionExpression->getFilterObjByExpr
    //builtCompleteFilter->getExprByFilterObj

    //public methods:
    //isAskForValues: check partsObj has 'ask for value' option or not
    //hasVirtualDate: check partsObj has virtual date (like today, yesterday) or not
    //getExprByFilterObj: partsObj->expr, get sql expression by json partsObj
    //getFilterObjByExpr: expr->partsObj, parse sql expression to json partsObj, this method is deprecated
    //prepare:set url and fields, method getFilterObjByExpr will read info from fields

    //modify methods(with hint 'code for wab'):
    //builtSingleFilterString


    //Description:
    //builtSingleFilterString is the core method used to convert single partObj to expr
    //parseSingleExpr is the core method used to parse single expr to partObj

    constructor: function(){
      String.prototype.startsWith = function(str) {
        return (this.indexOf(str) === 0);
      };

      String.prototype.endsWith = function(str) {
        return (this.substring(this.length - (str.length)) === str);
      };

      String.prototype.count = function (c) {
        return this.split(c).length - 1;
      };

      if(!String.prototype.trim){
        String.prototype.trim = lang.trim;
      }

      this._supportFieldTypes = [];
      this._supportFieldTypes.push(this._stringFieldType);
      this._supportFieldTypes.push(this._dateFieldType);
      this._supportFieldTypes = this._supportFieldTypes.concat(this._numberFieldTypes);

      this.filterBuilderNls = window.jimuNls.filterBuilder;
    },

    OPERATORS:{
      //string operators
      stringOperatorIs:'stringOperatorIs',
      stringOperatorIsNot:'stringOperatorIsNot',
      stringOperatorStartsWith:'stringOperatorStartsWith',
      stringOperatorEndsWith:'stringOperatorEndsWith',
      stringOperatorContains:'stringOperatorContains',
      stringOperatorDoesNotContain:'stringOperatorDoesNotContain',
      stringOperatorIsAnyOf: "stringOperatorIsAnyOf",
      stringOperatorIsNoneOf: "stringOperatorIsNoneOf",
      stringOperatorIsBlank:'stringOperatorIsBlank',
      stringOperatorIsNotBlank:'stringOperatorIsNotBlank',

      //new added
      //stringOperatorContainsCaseInSensitive:'stringOperatorContainsCaseInSensitive',

      //number operators
      numberOperatorIs:'numberOperatorIs',
      numberOperatorIsNot:'numberOperatorIsNot',
      numberOperatorIsAtLeast:'numberOperatorIsAtLeast',
      numberOperatorIsLessThan:'numberOperatorIsLessThan',
      numberOperatorIsAtMost:'numberOperatorIsAtMost',
      numberOperatorIsGreaterThan:'numberOperatorIsGreaterThan',
      numberOperatorIsBetween:'numberOperatorIsBetween',
      numberOperatorIsNotBetween:'numberOperatorIsNotBetween',
      numberOperatorIsAnyOf:'numberOperatorIsAnyOf',
      numberOperatorIsNoneOf:'numberOperatorIsNoneOf',
      numberOperatorIsBlank:'numberOperatorIsBlank',
      numberOperatorIsNotBlank:'numberOperatorIsNotBlank',

      //date operators
      dateOperatorIsOn:'dateOperatorIsOn',
      dateOperatorIsNotOn:'dateOperatorIsNotOn',
      dateOperatorIsBefore:'dateOperatorIsBefore',
      dateOperatorIsAfter:'dateOperatorIsAfter',
      dateOperatorIsOnOrBefore:'dateOperatorIsOnOrBefore',
      dateOperatorIsOnOrAfter:'dateOperatorIsOnOrAfter',
      dateOperatorIsBetween:'dateOperatorIsBetween',
      dateOperatorIsNotBetween:'dateOperatorIsNotBetween',
      dateOperatorIsBlank:'dateOperatorIsBlank',
      dateOperatorIsNotBlank:'dateOperatorIsNotBlank',
      dateOperatorInTheLast:'dateOperatorInTheLast',
      dateOperatorNotInTheLast:'dateOperatorNotInTheLast',
      dateOperatorIsIn:'dateOperatorIsIn',
      dateOperatorIsNotIn:'dateOperatorIsNotIn',

      //not operators, date types used for dateOperatorInTheLast and dateOperatorNotInTheLast
      dateOperatorMinutes:'dateOperatorMinutes',
      dateOperatorHours:'dateOperatorHours',
      dateOperatorDays:'dateOperatorDays',
      dateOperatorWeeks:'dateOperatorWeeks',
      dateOperatorMonths:'dateOperatorMonths',
      dateOperatorYears:'dateOperatorYears'
    },

    //set url and fields, method getFilterObjByExpr will read info from fields
    //allFieldsInfos: layerDefinition.fields
    prepare: function(url, allFieldsInfos){
      this.isHosted = jimuUtils.isHostedService(url);
      allFieldsInfos = allFieldsInfos || [];
      this.setFieldsStoreByFieldInfos(allFieldsInfos);
    },

    isPartsObjHasError: function(partsObj){
      var isValidPartsObj = false;
      if(partsObj){
        if(partsObj.parts && partsObj.parts.length >= 0){
          isValidPartsObj = array.every(partsObj.parts, lang.hitch(this, function(part){
            if(part.parts){
              if(part.parts.length > 0){
                return array.every(part.parts, lang.hitch(this, function(singlePart){
                  return !singlePart.error;
                }));
              }else{
                return false;
              }
            }else{
              return !part.error;
            }
          }));
        }else{
          isValidPartsObj = false;
        }
      }
      return !isValidPartsObj;
    },

    //check partsObj has 'ask for value' option or not
    isAskForValues: function(partsObj){
      return clazz.isAskForValues(partsObj);
    },

    //check partsObj has virtual date (like today, yesterday) or not
    hasVirtualDate: function(partsObj){
      return clazz.hasVirtualDate(partsObj);
    },

    setFieldsStoreByFieldInfos: function(allFieldsInfos){
      var fieldsInfos = array.filter(allFieldsInfos, lang.hitch(this, function(fieldInfo){
        return this._supportFieldTypes.indexOf(fieldInfo.type) >= 0;
      }));
      var items = array.map(fieldsInfos, function(fieldInfo, idx){
        var shortType;
        switch (fieldInfo.type) {
          case "esriFieldTypeString":
            shortType = "string";
            break;
          case "esriFieldTypeDate":
            shortType = "date";
            break;
          default: // numbers
            shortType = "number";
            break;
        }

        return {
          id:  idx,
          label: fieldInfo.name, //fieldInfo.label, //(fieldInfo.alias || fieldInfo.name),
          shortType: shortType,
          alias: fieldInfo.alias,
          editable: fieldInfo.editable,
          name: fieldInfo.name,
          nullable: fieldInfo.nullable,
          type: fieldInfo.type
        };
      }, this);

      this.fieldsStore = new ItemFileWriteStore({
        data: {
          identifier: 'id',
          label: 'label',
          items: items
        }
      });

      return items.length;
    },

    _validatePartsObj:function(partsObj){
      return partsObj && typeof partsObj === 'object';
    },

    _isObject: function(o){
      return o && typeof o === 'object';
    },

    _isString: function(s){
      return s && typeof s === 'string';
    },

    containsNonLatinCharacter: function(string) {
      /*
      console.log(string);
      for (var k = 0; k < string.length; k++) {
        console.log(string.charCodeAt(k));
      }
      */
      for (var i = 0; i < string.length; i++) {
        if (string.charCodeAt(i) > 255) {
          return true;
        }
      }
      return false;

    },

    isBigDataLayer: function(layer) {
      return !!layer.url && layer.url.indexOf("BigDataCatalogServer") !== -1 && (layer.type === "featureClass" || layer.type === "table");
    },

    useStandardizedQueries: function(layer) {
      // Fix the cases of old versions: options.layerDefinition is optional in Filter.build(options)
      if (!layer) {
        return !this.isHosted;
      }
      return layer.version >= 10.2 && (layer.useStandardizedQueries || this.isBigDataLayer(layer));
    },

    getLayerTimezoneOffset: function(layer) {
      var offset = 0; // UTC is by default
      if (layer && layer.dateFieldsTimeReference && layer.dateFieldsTimeReference.timeZone !== 'UTC') {
        offset = clazz.TIMEZONE_DATA[layer.dateFieldsTimeReference.timeZone].offset * 60 * 60 * 1000
      }
      return offset
    },

    /**************************************************/
    /****  stringify                               ****/
    /**************************************************/
    //builtCompleteFilter
    //partsObj->expr, get sql expression by json partsObj
    //1. If return null or empty string, it means we can't get a valid sql expresion
    //2. If return a non-empty string, it means we can get a valid sql expression
    getExprByFilterObj: function(partsObj) {
      //check part if valid or not, if part is null, it is invalid
      var isValidParts = array.every(partsObj.parts, function(part){
        return !!part;
      });
      if(!isValidParts){
        return null;
      }

      //before build filter string, we need to check it is ready or not to build
      //because user maybe check 'Ask for values' option and place empty value(s)
      if(!this.isPartsObjReadyToBuild(partsObj)){
        partsObj.expr = "";
        partsObj.displaySQL = "";
        return partsObj.expr;
      }

      //convert virtual date to real date
      this._handleVirtualDate(partsObj);

      //real code to build filter string
      var filterString = "", displaySQL = "";
      var part, isChecked;
      if(partsObj.parts.length === 0){
        filterString = "1=1";
        displaySQL = "1=1";
      }else if(partsObj.parts.length === 1) {
        part = partsObj.parts[0];
        if(part.valueObj && lang.isArray(part.valueObj.value) && part.valueObj.type !== 'multiple'){
          isChecked = this._checkIfValObjArrayAndChecked(part.valueObj.value);
          if(isChecked){
            filterString = this.builtFilterString(part);
            displaySQL = part.displaySQL;
          }else{
            filterString = "1=1";
            displaySQL = "1=1";
          }
        }else{
          filterString = this.builtFilterString(part);
          displaySQL = part.displaySQL;
        }
      } else {
        var join = "";
        //dojo.forEach(allFilters, function(node){
        for (var i = 0; i < partsObj.parts.length; i++) {
          part = partsObj.parts[i];

          var str, str2;
          if(part.valueObj && lang.isArray(part.valueObj.value) && part.valueObj.type !== 'multiple'){
            isChecked = this._checkIfValObjArrayAndChecked(part.valueObj.value);
            if(isChecked){
              str = this.builtFilterString(part);
              str2 = part.displaySQL;
            }else{
              str = "1=1";
              str2 = "1=1";
            }
          }else{
            str = this.builtFilterString(part);
            str2 = part.displaySQL;
          }
          if (!esriLang.isDefined(str)) {
            // we're missing input
            return null;
          }
          filterString += join + "(" + str + ")";
          displaySQL += join + "(" + str2 + ")";
          join = join || (" " + partsObj.logicalOperator + " ");
        }
      }
      partsObj.expr = filterString;
      partsObj.displaySQL = displaySQL;
      return filterString;
    },

    _checkIfValObjArrayAndChecked: function(valObjArray){
      var isChecked = false;
      for(var key in valObjArray){
        if(valObjArray[key].isChecked){
          isChecked = true;
          break;
        }
      }
      return isChecked;
    },

    _handleVirtualDate: function(partsObj){
      if(!this.hasVirtualDate(partsObj)){
        return;
      }
      array.forEach(partsObj.parts, lang.hitch(this, function(part){
        if(part.parts){
          array.forEach(part.parts, lang.hitch(this, function(singlePart){
            this._updateRealDateByVirtualDate(singlePart);
          }));
        }else{
          this._updateRealDateByVirtualDate(part);
        }
      }));
    },

    _updateRealDateByVirtualDate: function(singlePart){
      var v;
      var singleVirtualDateOpts = [
        this.OPERATORS.dateOperatorIsOn,
        this.OPERATORS.dateOperatorIsNotOn,
        this.OPERATORS.dateOperatorIsBefore,
        this.OPERATORS.dateOperatorIsAfter,
        this.OPERATORS.dateOperatorIsOnOrBefore,
        this.OPERATORS.dateOperatorIsOnOrAfter
      ];
      if(singlePart.valueObj.virtualDate){
        if(singlePart.operator === this.OPERATORS.dateOperatorIsIn ||
          singlePart.operator === this.OPERATORS.dateOperatorIsNotIn){
          var values = clazz.getRealDateByVirtualDate(singlePart.valueObj.virtualDate);
          singlePart.value1 = values[0];
          singlePart.value2 = values[1];
          singlePart.valueObj.value1 = jimuUtils.getDateTimeStr(values[0]);
          singlePart.valueObj.value2 = jimuUtils.getDateTimeStr(values[1]);
        }else if(singleVirtualDateOpts.indexOf(singlePart.operator) > -1){
          v = clazz.getRealDateByVirtualDate(singlePart.valueObj.virtualDate);
          singlePart.value = v;
          singlePart.valueObj.value = jimuUtils.getDateTimeStr(v);
        }
      }else{
        if(singlePart.valueObj.virtualDate1){
          v = clazz.getRealDateByVirtualDate(singlePart.valueObj.virtualDate1);
          singlePart.value1 = v;
          singlePart.valueObj.value1 = jimuUtils.getDateTimeStr(v);
        }

        if(singlePart.valueObj.virtualDate2){
          v = clazz.getRealDateByVirtualDate(singlePart.valueObj.virtualDate2);
          singlePart.value2 = v;
          singlePart.valueObj.value2 = jimuUtils.getDateTimeStr(v);
        }
      }
    },

    //check it is ready or not to build filter string by askForValues opiton
    isPartsObjReadyToBuild: function(partsObj){
      var isReady = array.every(partsObj.parts, lang.hitch(this, function(part){
        var result;
        if(part.parts){
          result = array.every(part.parts, lang.hitch(this, function(subPart){
            return this._isPartReadyToBuild(subPart);
          }));
        }else{
          result = this._isPartReadyToBuild(part);
        }
        return result;
      }));
      return isReady;
    },

    _isPartReadyToBuild: function(part){
      var shortType = part.fieldObj.shortType;
      var operator = part.operator;
      var valueObj = part.valueObj;
      //if value type is missing, we use 'value' as default
      //it is useful when parse a sql into partsObj because it doesn't have value type
      var valueType = valueObj.type || 'value';
      var value = valueObj.value;
      var value1 = valueObj.value1;
      var value2 = valueObj.value2;

      if (valueType === 'value') {
        if (shortType === 'string') {
          if (operator === this.OPERATORS.stringOperatorIsBlank ||
            operator === this.OPERATORS.stringOperatorIsNotBlank) {
            return true;
          } else {
            return jimuUtils.isNotEmptyString(value);
          }
        } else if (shortType === 'number') {
          if(operator === this.OPERATORS.numberOperatorIsBlank ||
             operator === this.OPERATORS.numberOperatorIsNotBlank){
            return true;
          }else if(operator === this.OPERATORS.numberOperatorIsBetween ||
                  operator === this.OPERATORS.numberOperatorIsNotBetween){
            return jimuUtils.isValidNumber(value1) && jimuUtils.isValidNumber(value2);
          }else{
            return jimuUtils.isValidNumber(value);
          }
        } else if (shortType === 'date') {
          if(operator === this.OPERATORS.dateOperatorIsBlank ||
             operator === this.OPERATORS.dateOperatorIsNotBlank){
            return true;
          }
          else if(operator === this.OPERATORS.dateOperatorIsBetween ||
                  operator === this.OPERATORS.dateOperatorIsNotBetween ||
                  operator === this.OPERATORS.dateOperatorIsIn ||
                  operator === this.OPERATORS.dateOperatorIsNotIn){
            return jimuUtils.isNotEmptyString(value1) && jimuUtils.isNotEmptyString(value2);
          }
          else if(operator === this.OPERATORS.dateOperatorInTheLast ||
                  operator === this.OPERATORS.dateOperatorNotInTheLast){
            return value !== undefined && value !== null;
          }else{
            return jimuUtils.isNotEmptyString(value);
          }
        }
      }else if(valueType === 'field'){
        return jimuUtils.isNotEmptyString(value);
      }else if(valueType === 'unique'){
        if(shortType === 'string'){
          return jimuUtils.isNotEmptyString(value);
        }else if(shortType === 'number'){
          return jimuUtils.isValidNumber(value);
        }else if(shortType === 'date'){
          return jimuUtils.isValidDate(value);
        }
      }
      else if(valueType === 'multiple'){
        if(shortType === 'string'){
          return jimuUtils.isNotEmptyStringArray(value);
        }else if(shortType === 'number'){
          return jimuUtils.isValidNumberArray(value);
        }
      }
      else if(valueType === 'values'){

      }
      else if(valueType === 'uniquePredefined' || valueType === 'multiplePredefined'){
        if(shortType === 'string'){
          return jimuUtils.isNotEmptyStringArray(value);
        }else if(shortType === 'number'){
          return jimuUtils.isValidNumberArray(value);
        }
      }

      return false;
    },

    builtFilterString: function(partsObj) {
      var filterString = "", displaySQL = "";
      if (partsObj.parts) {
        // set
        var join = "";
        for (var i = 0; i < partsObj.parts.length; i++) {
          var part = partsObj.parts[i];
          var obj = this.builtSingleFilterString(part);
          part.expr = obj.whereClause;  //displaySQL exists in part already
          if (!esriLang.isDefined(obj.whereClause)) {
            // we're missing input
            return null;
          }
          filterString += join + obj.whereClause;
          displaySQL += join + part.displaySQL;
          join = " " + partsObj.logicalOperator + " ";
        }
      } else {
        // single expression
        if(partsObj && partsObj.valueObj && partsObj.valueObj.type === 'multiple' &&
          partsObj.valueObj.value.length === 0){
          filterString = displaySQL = '1=1';
        }else{
          filterString = this.builtSingleFilterString(partsObj).whereClause;
          displaySQL = partsObj.displaySQL;
        }
      }
      partsObj.expr = filterString;
      partsObj.displaySQL = displaySQL;
      return filterString;
    },

    _preBuiltSingleFilterString: function(part){
      if(part.fieldObj.shortType === 'string' && part.valueObj.value === "<Null>"){
        if(part.operator === this.OPERATORS.stringOperatorIs){
          return {
            whereClause: part.fieldObj.name + " IS NULL"
          };
        }else if(part.operator === this.OPERATORS.stringOperatorIsNot){
          return {
            whereClause: part.fieldObj.name + " IS NOT NULL"
          };
        }
      }

      if(part.fieldObj.shortType === 'number' && part.valueObj.value === "<Null>"){
        if(part.operator === this.OPERATORS.numberOperatorIs){
          return {
            whereClause: part.fieldObj.name + " IS NULL"
          };
        }else if(part.operator === this.OPERATORS.numberOperatorIsNot){
          return {
            whereClause: part.fieldObj.name + " IS NOT NULL"
          };
        }
      }
      return null;
    },

    //get stings with prefix for operator: isIn or not (multiple and predefined-multiple)
    //handels strings, like: abc a'b'c, a"b"c
    _handlePrefixStringsForIn: function(valsArray, caseSensitive){
      var newVals = [];
      for(var key = 0; key < valsArray.length; key ++){
        var val = valsArray[key];
        val = val.replace(/\'/g, "''");//use '' instead of ' to build expr
        var prefix = (this.isHosted && this.containsNonLatinCharacter(val)) ? 'N' : '';
        val = (caseSensitive || this.isHosted) ? val : val.toLowerCase();
        val = "" + prefix + "'" + val + "'";
        newVals.push(val);
      }
      return newVals.join(","); //"'Clow',N'Qβ'"
    },

    getDateValueByLayerTimeOffset: function(date, layerTimeZoneOffset) {
      return layerTimeZoneOffset === 0 ? date : new Date(date.getTime() + layerTimeZoneOffset)
    },

    builtSingleFilterString: function(part) {

      if(this.isHosted){
        part.caseSensitive = false;
      }
      // TODO check that expression value has a value ...
      if (esriLang.isDefined(part.valueObj.isValid) && !part.valueObj.isValid) {
        return {
          whereClause: null
        };
      }

      var preBuildResult = this._preBuiltSingleFilterString(part);
      if(preBuildResult){
        return preBuildResult;
      }

      var value = part.valueObj.value;
      var value1 = part.valueObj.value1;
      var value2 = part.valueObj.value2;

      var whereClause = "", displaySQL = "";
      var valsArray = [];
      if (part.fieldObj.shortType === "string") {

        var prefix = "";
        if (value && part.valueObj.type !== 'field' && this.isHosted) {
          if(!lang.isArray(value) && this.containsNonLatinCharacter(value)){
            prefix = 'N';
          }
        }

        //exact query for predefined types
        if(value && (part.valueObj.type === 'multiplePredefined' || part.valueObj.type === 'uniquePredefined')){
          valsArray = [];
          array.forEach(value, lang.hitch(this, function(valObj) {
            if(valObj.isChecked){
              valsArray.push(valObj.value);
            }
          }));

          //add functions to get 'a','b','c' from [{value:'a'},{}]
          // valsArray = valsArray.length > 0 ? valsArray : ['']; //does not exist
          if(part.operator === this.OPERATORS.stringOperatorIs || part.operator === this.OPERATORS.stringOperatorIsNot){
            value = valsArray[0];
            if(this.isHosted && this.containsNonLatinCharacter(value)){
              prefix = 'N';
            }
          }else{ //is any of, contain, start with, ...
            value = valsArray;
          }
        }
        var subWhereClause = [];
        switch (part.operator) {
          case this.OPERATORS.stringOperatorIs:
            if (part.valueObj.type === 'field') {
              whereClause = part.fieldObj.name + " = " + value;
            }else {
              if(part.caseSensitive || this.isHosted){
                whereClause = part.fieldObj.name + " = " +
                 prefix + "'" + value.replace(/\'/g, "''") + "'";
              }else{
                whereClause = "LOWER(" + part.fieldObj.name + ") = " +
                 "" + prefix + "'" + value.replace(/\'/g, "''").toLowerCase() + "'";
              }
            }
            break;
          case this.OPERATORS.stringOperatorIsNot:
            if (part.valueObj.type === 'field') {
              whereClause = part.fieldObj.name + " <> " + value;
            }else {
              if(part.caseSensitive || this.isHosted){
                whereClause = part.fieldObj.name + " <> " + prefix +
                 "'" + value.replace(/\'/g, "''") + "'";
              }else{
                whereClause = "LOWER(" + part.fieldObj.name + ") <> " +
                 "" + prefix + "'" + value.replace(/\'/g, "''").toLowerCase() + "'";
              }
            }
            break;
          case this.OPERATORS.stringOperatorStartsWith:
            subWhereClause = [];
            if (part.valueObj.type === 'multiplePredefined' || part.valueObj.type === 'uniquePredefined') {
              array.forEach(value, lang.hitch(this, function(val) {
                var _prefix = (this.isHosted && this.containsNonLatinCharacter(val)) ? 'N' : '';
                if(part.caseSensitive || this.isHosted){
                  subWhereClause.push(part.fieldObj.name + " LIKE " + _prefix +
                   "'" + val.replace(/\'/g, "''") + "%'");
                }
                else{
                  subWhereClause.push("LOWER(" + part.fieldObj.name + ") LIKE " +
                   "" + _prefix + "'" + val.replace(/\'/g, "''").toLowerCase() + "%'");
                }
              }));
              whereClause = "((" + subWhereClause.join(') OR (') + "))";
            }else{
              if(part.caseSensitive || this.isHosted){
                whereClause = part.fieldObj.name + " LIKE " + prefix +
                "'" + value.replace(/\'/g, "''") + "%'";
              }
              else{
                //LOWER(County) LIKE LOWER(N'石景山区%')
                whereClause = "LOWER(" + part.fieldObj.name + ") LIKE " +
                "" + prefix + "'" + value.replace(/\'/g, "''").toLowerCase() + "%'";
              }
            }
            break;
          case this.OPERATORS.stringOperatorEndsWith:
            subWhereClause = [];
            if (part.valueObj.type === 'multiplePredefined' || part.valueObj.type === 'uniquePredefined') {
              array.forEach(value, lang.hitch(this, function(val) {
                var _prefix = (this.isHosted && this.containsNonLatinCharacter(val)) ? 'N' : '';
                if(part.caseSensitive || this.isHosted){
                  subWhereClause.push(part.fieldObj.name + " LIKE " + _prefix +
                  "'%" + val.replace(/\'/g, "''") + "'");
                }
                else{
                  subWhereClause.push("LOWER(" + part.fieldObj.name + ") LIKE " +
                  "" + _prefix + "'%" + val.replace(/\'/g, "''").toLowerCase() + "'");
                }
              }));
              whereClause = "((" + subWhereClause.join(') OR (') + "))";
            }else{
              if(part.caseSensitive || this.isHosted){
                whereClause = part.fieldObj.name + " LIKE " + prefix +
              "'%" + value.replace(/\'/g, "''") + "'";
              }
              else{
                //LOWER(County) LIKE LOWER(N'%石景山区')
                whereClause = "LOWER(" + part.fieldObj.name + ") LIKE " +
              "" + prefix + "'%" + value.replace(/\'/g, "''").toLowerCase() + "'";
              }
            }
            break;
          case this.OPERATORS.stringOperatorContains:
            subWhereClause = [];
            if (part.valueObj.type === 'multiplePredefined' || part.valueObj.type === 'uniquePredefined') {
              array.forEach(value, lang.hitch(this, function(val) {
                var _prefix = (this.isHosted && this.containsNonLatinCharacter(val)) ? 'N' : '';
                if(part.caseSensitive || this.isHosted){
                  subWhereClause.push(part.fieldObj.name + " LIKE " + _prefix +
                  "'%" + val.replace(/\'/g, "''") + "%'");
                }
                else{
                  subWhereClause.push("LOWER(" + part.fieldObj.name + ") LIKE " +
                  "" + _prefix + "'%" + val.replace(/\'/g, "''").toLowerCase() + "%'");
                }
              }));
              whereClause = "((" + subWhereClause.join(') OR (') + "))";
            }else{
              if(part.caseSensitive || this.isHosted){
                whereClause = part.fieldObj.name + " LIKE " + prefix +
              "'%" + value.replace(/\'/g, "''") + "%'";
              }
              else{
                //LOWER(County) LIKE LOWER(N'%石景山区%')
                whereClause = "LOWER(" + part.fieldObj.name + ") LIKE " +
              "" + prefix + "'%" + value.replace(/\'/g, "''").toLowerCase() + "%'";
              }
            }
            break;
          case this.OPERATORS.stringOperatorDoesNotContain:
            subWhereClause = [];
            if (part.valueObj.type === 'multiplePredefined' || part.valueObj.type === 'uniquePredefined') {
              array.forEach(value, lang.hitch(this, function(val) {
                var _prefix = (this.isHosted && this.containsNonLatinCharacter(val)) ? 'N' : '';
                if(part.caseSensitive || this.isHosted){
                  subWhereClause.push(part.fieldObj.name + " NOT LIKE " + _prefix +
                  "'%" + val.replace(/\'/g, "''") + "%'");
                }
                else{
                  subWhereClause.push("LOWER(" + part.fieldObj.name + ") NOT LIKE " +
                  "" + _prefix + "'%" + val.replace(/\'/g, "''").toLowerCase() + "%'");
                }
              }));
              whereClause = "((" + subWhereClause.join(') AND (') + "))";
            }else{
              if(part.caseSensitive || this.isHosted){
                whereClause = part.fieldObj.name + " NOT LIKE " + prefix +
              "'%" + value.replace(/\'/g, "''") + "%'";
              }
              else{
                //LOWER(County) NOT LIKE LOWER(N'%石景山区%')
                whereClause = "LOWER(" + part.fieldObj.name + ") NOT LIKE " +
              "" +  prefix + "'%" + value.replace(/\'/g, "''").toLowerCase() + "%'";
              }
            }
            break;
          case this.OPERATORS.stringOperatorIsAnyOf: //caseSensitive
            value = this._handlePrefixStringsForIn(value, part.caseSensitive);
            if(part.caseSensitive || this.isHosted){
              whereClause = part.fieldObj.name + " IN (" + value + ")";
            }else{
              whereClause = "LOWER(" + part.fieldObj.name + ") IN (" + value + ")";
            }
            break;
          case this.OPERATORS.stringOperatorIsNoneOf:
            value = this._handlePrefixStringsForIn(value, part.caseSensitive);
            if(part.caseSensitive || this.isHosted){
              whereClause = part.fieldObj.name + " NOT IN (" + value + ")";
            }else{
              whereClause = "LOWER(" + part.fieldObj.name + ") NOT IN (" + value + ")";
            }
            break;
          case this.OPERATORS.stringOperatorIsBlank:
            whereClause = part.fieldObj.name + " IS NULL";
            break;
          case this.OPERATORS.stringOperatorIsNotBlank:
            whereClause = part.fieldObj.name + " IS NOT NULL";
            break;
        }

      } else if (part.fieldObj.shortType === "number") {
        if(value &&  (part.valueObj.type === 'uniquePredefined' || part.valueObj.type === 'multiplePredefined')){
          //add functions to get '1,2,3' from [{value:'1'},{value:'2'}]
          valsArray = [];
          array.forEach(value, lang.hitch(this, function(valObj) {
            if(valObj.isChecked){
              valsArray.push(valObj.value);
            }
          }));
          value = valsArray.join(',');
        }else if(value && part.valueObj.type === 'multiple'){
          value = value.join(',');
        }
        switch (part.operator) {
          case this.OPERATORS.numberOperatorIs:
            whereClause = part.fieldObj.name + " = " + value;
            break;
          case this.OPERATORS.numberOperatorIsNot:
            whereClause = part.fieldObj.name + " <> " + value;
            break;
          case this.OPERATORS.numberOperatorIsAtLeast:
            whereClause = part.fieldObj.name + " >= " + value;
            break;
          case this.OPERATORS.numberOperatorIsLessThan:
            whereClause = part.fieldObj.name + " < " + value;
            break;
          case this.OPERATORS.numberOperatorIsAtMost:
            whereClause = part.fieldObj.name + " <= " + value;
            break;
          case this.OPERATORS.numberOperatorIsGreaterThan:
            whereClause = part.fieldObj.name + " > " + value;
            break;
          case this.OPERATORS.numberOperatorIsAnyOf:
            whereClause = part.fieldObj.name + " IN (" + value + ")";
            break;
          case this.OPERATORS.numberOperatorIsNoneOf:
            whereClause = part.fieldObj.name + " NOT IN (" + value + ")";
            break;
          case this.OPERATORS.numberOperatorIsBetween:
            whereClause = part.fieldObj.name + " BETWEEN " + value1 + " AND " + value2;
            break;
          case this.OPERATORS.numberOperatorIsNotBetween:
            whereClause = part.fieldObj.name + " NOT BETWEEN " + value1 + " AND " + value2;
            break;
          case this.OPERATORS.numberOperatorIsBlank:
            whereClause = part.fieldObj.name + " IS NULL";
            break;
          case this.OPERATORS.numberOperatorIsNotBlank:
            whereClause = part.fieldObj.name + " IS NOT NULL";
            break;
        }

      } else { // date
        // value is Date object when we had a DateTextBox
        // value is String when we had unique values list
        // if(part.valueObj.type === 'unique'){
        //   value = jimuUtils.getDateByDateTimeStr(value);
        // }
        // if (esriLang.isDefined(value) && part.valueObj.type !== 'field' &&
        //  (typeof value === "string")) {
        //   // e.g. "7/7/2010 12:00:00 AM" returned by generateRenderer
        //   value = new Date(value);
        // }

        var valueOffseted;
        var value1Offseted;
        var value2Offseted;

        var supportsStandardizedQuery = part._useStandardizedQueries
        //start
        if(part.valueObj.type !== 'field'){
          if(value){
            value = jimuUtils.getDateByDateTimeStr(value);
            valueOffseted = this.getDateValueByLayerTimeOffset(value, part._layerTimeZoneOffset)
          }
          if(value1){
            value1 = jimuUtils.getDateByDateTimeStr(value1);
            value1Offseted = this.getDateValueByLayerTimeOffset(value1, part._layerTimeZoneOffset)
          }
          if(value2){
            value2 = jimuUtils.getDateByDateTimeStr(value2);
            value2Offseted = this.getDateValueByLayerTimeOffset(value2, part._layerTimeZoneOffset)
          }
        }
        //end
        var enableTime = part.valueObj.enableTime;
        var timeAccuracy = part.valueObj.timeAccuracy;
        var endDateTime;
        switch (part.operator) {
          case this.OPERATORS.dateOperatorIsOn:
            if (part.valueObj.type === 'field') {
              whereClause = part.fieldObj.name + " = " + value;
            } else {
              if (part.valueObj.type === 'unique'){
                endDateTime = this._getEndDateByTimeForUnique(valueOffseted, part.fieldObj.dateFormat);
              }else{
                endDateTime = this._getEndDateByTime(valueOffseted, enableTime, timeAccuracy);
              }
              whereClause = "(" + part.fieldObj.name + " BETWEEN " + (!supportsStandardizedQuery? "" : "timestamp ") +
                "'" + this.formatDate(valueOffseted) + "' AND " + (!supportsStandardizedQuery? "" : "timestamp ") +
                "'" + endDateTime + "') AND " +
                "(" + part.fieldObj.name + " <> " + (!supportsStandardizedQuery? "" : "timestamp ") + "'" + endDateTime + "')";
            }
            break;
          case this.OPERATORS.dateOperatorIsNotOn:
            if (part.valueObj.type === 'field') {
              whereClause = part.fieldObj.name + " <> " + value;
            } else {
              if (part.valueObj.type === 'unique'){
                endDateTime = this._getEndDateByTimeForUnique(valueOffseted, part.fieldObj.dateFormat);
              }else{
                endDateTime = this._getEndDateByTime(valueOffseted, enableTime, timeAccuracy);
              }
              whereClause = "(" + part.fieldObj.name + " < " +
                (!supportsStandardizedQuery? "" : "timestamp ") + "'" + this.formatDate(valueOffseted) + "') OR " +
                "(" + part.fieldObj.name + " >= " + (!supportsStandardizedQuery? "" : "timestamp ") + "'" + endDateTime + "')";
            }
            break;
          case this.OPERATORS.dateOperatorIsBefore:
            if (part.valueObj.type === 'field') {
              whereClause = part.fieldObj.name + " < " + value;
            } else {
              whereClause = part.fieldObj.name + " < " +
               (!supportsStandardizedQuery? "" : "timestamp ") + "'" + this.formatDate(valueOffseted) + "'";
            }
            break;
          case this.OPERATORS.dateOperatorIsAfter:
            if (part.valueObj.type === 'field') {
              whereClause = part.fieldObj.name + " > " + value;
            } else {
              if (part.valueObj.type === 'unique'){
                endDateTime = this._getEndDateByTimeForUnique(valueOffseted, part.fieldObj.dateFormat);
              }else{
                endDateTime = this._getEndDateByTime(valueOffseted, enableTime, timeAccuracy);
              }
              whereClause = part.fieldObj.name + " >= " +
                (!supportsStandardizedQuery? "" : "timestamp ") + "'" + endDateTime + "'";
            }
            break;
          case this.OPERATORS.dateOperatorIsOnOrBefore:
            if (part.valueObj.type === 'field') {
              whereClause = part.fieldObj.name + " <= " + value;
            } else {
              if (part.valueObj.type === 'unique'){
                endDateTime = this._getEndDateByTimeForUnique(valueOffseted, part.fieldObj.dateFormat);
              }else{
                endDateTime = this._getEndDateByTime(valueOffseted, enableTime, timeAccuracy);
              }
              whereClause = part.fieldObj.name + " < " +
                (!supportsStandardizedQuery? "" : "timestamp ") + "'" + endDateTime + "'";
            }
            break;
          case this.OPERATORS.dateOperatorIsOnOrAfter:
            if (part.valueObj.type === 'field') {
              whereClause = part.fieldObj.name + " >= " + value;
            } else {
              whereClause = part.fieldObj.name + " >= " +
               (!supportsStandardizedQuery? "" : "timestamp ") + "'" + this.formatDate(valueOffseted) + "'";
            }
            break;
          case this.OPERATORS.dateOperatorInTheLast:
            whereClause = part.fieldObj.name + " BETWEEN CURRENT_TIMESTAMP - " +
              this._convertRangeToDays(part.valueObj.value, part.valueObj.range) +
              " AND CURRENT_TIMESTAMP";
            break;
          case this.OPERATORS.dateOperatorNotInTheLast:
            whereClause = part.fieldObj.name + " NOT BETWEEN CURRENT_TIMESTAMP - " +
              this._convertRangeToDays(part.valueObj.value, part.valueObj.range) +
              " AND CURRENT_TIMESTAMP";
            break;
          case this.OPERATORS.dateOperatorIsBetween:
          case this.OPERATORS.dateOperatorIsIn:
            endDateTime = this._getEndDateByTime(value2Offseted, part.valueObj.enableTime2, part.valueObj.timeAccuracy2);
            whereClause = "(" + part.fieldObj.name + " BETWEEN " + (!supportsStandardizedQuery? "" : "timestamp ") +
              "'" + this.formatDate(value1Offseted) + "' AND " + (!supportsStandardizedQuery? "" : "timestamp ") +
              "'" + endDateTime + "') AND " +
              "(" + part.fieldObj.name + " <> " + (!supportsStandardizedQuery? "" : "timestamp ") + "'" + endDateTime + "')";
            break;
          case this.OPERATORS.dateOperatorIsNotBetween:
          case this.OPERATORS.dateOperatorIsNotIn:
            endDateTime = this._getEndDateByTime(value2Offseted, part.valueObj.enableTime2, part.valueObj.timeAccuracy2);
            whereClause = "(" + part.fieldObj.name + " < " +
              (!supportsStandardizedQuery? "" : "timestamp ") + "'" + this.formatDate(value1Offseted) + "') OR " +
              "(" + part.fieldObj.name + " >= " + (!supportsStandardizedQuery? "" : "timestamp ") + "'" + endDateTime + "')";
            break;
          case this.OPERATORS.dateOperatorIsBlank:
            whereClause = part.fieldObj.name + " IS NULL";
            break;
          case this.OPERATORS.dateOperatorIsNotBlank:
            whereClause = part.fieldObj.name + " IS NOT NULL";
            break;
        }
      }

      if(part.fieldObj.shortType === "date"){
        // displaySQL = this.getDisplaySQL(part.fieldObj.name,part.valueObj,part.operator);
        var _valObj = lang.clone(part.valueObj);
        _valObj.dateFormat = part.fieldObj.dateFormat;
        displaySQL = this.getDisplaySQL(part.fieldObj.name, _valObj, part.operator);
      }else{
        displaySQL = whereClause;
      }
      part.displaySQL = displaySQL;

      return {
        whereClause: whereClause
      };
    },

    //Between dt1 and dt2, it includes dt1 and dt2
    //enableTime = true:
    //  for shorTime: "6:30"-->["6:30:00", "6:31:00"] excluding the last moment.
    //  for longTime/noTime: "6:30:15"-->["6:30:15", "6:30:16"] excluding the last moment.
    _getEndDateByTime:function(value, enableTime, timeAccuracy){//, dateFormat){
      var newValue;
      if(enableTime){
        if(timeAccuracy === 's'){
          newValue = this.addSec(value);
        }else if(timeAccuracy === 'm'){
          newValue = this.addMinute(value);
        }else{//h
          newValue = this.addHour(value);
        }
      }else{
        newValue = this.addDay(value);
      }
      return this.formatDate(newValue);
    },

    //  honor date format by mapviewer configured
    //  for shorTime: "6:30"-->["6:30:00", "6:31:00"] excluding the last moment.
    //  for longTime: "6:30:15"-->["6:30:15", "6:30:16"] excluding the last moment.
    //  for noTime/noDateFormat:'ymd'--->['ymd 00:00:00', 'ymd 00:00:00'] excluding the last moment.
    _getEndDateByTimeForUnique:function(value, dateFormat){
      var newValue;
      if(dateFormat && dateFormat.indexOf('ShortTime') >= 0){
        newValue = this.addMinute(value);
      }else if(dateFormat && dateFormat.indexOf('LongTime') >= 0){
        newValue = this.addSec(value);
      }else {
        newValue = this.addDay(value);
      }
      return this.formatDate(newValue);
    },

    _getDisplayDates:function(valObj){
      var uiDates = {value: valObj.virtualDate, value1: valObj.virtualDate1, value2: valObj.virtualDate2};
      var fieldInfo = valObj.dateFormat === "" ? {} : {format: {dateFormat: valObj.dateFormat}};
      if(valObj.virtualDate === '' || valObj.virtualDate === undefined){
        if(valObj.type === "field"){
          uiDates.value = valObj.value;
        }else if(valObj.type === "unique"){
          uiDates.value = jimuUtils.localizeDateByFieldInfo(jimuUtils.getDateByDateTimeStr(valObj.value), fieldInfo);
        }else{
          uiDates.value = jimuUtils.localizeDateTimeByFieldInfo(jimuUtils.getDateByDateTimeStr(valObj.value), fieldInfo,
           valObj.enableTime, valObj.timeAccuracy);
        }
      }else{
        uiDates.value = this.filterBuilderNls[valObj.virtualDate];
      }

      if(valObj.virtualDate1 === ''){
        uiDates.value1 = jimuUtils.localizeDateTimeByFieldInfo(jimuUtils.getDateByDateTimeStr(valObj.value1),
         fieldInfo, valObj.enableTime1, valObj.timeAccuracy1);
      }else{
        uiDates.value1 = this.filterBuilderNls[valObj.virtualDate1];
      }

      if(valObj.virtualDate2 === ''){
        uiDates.value2 = jimuUtils.localizeDateTimeByFieldInfo(jimuUtils.getDateByDateTimeStr(valObj.value2),
         fieldInfo, valObj.enableTime2, valObj.timeAccuracy2);
      }else{
        uiDates.value2 = this.filterBuilderNls[valObj.virtualDate2];
      }

      return uiDates;
    },

    getDisplaySQL:function(fName, valObj, type){
      var whereClause = '';
      if(type.indexOf('InTheLast') > 0){
        whereClause = this.filterBuilderNls[type] + ' ' + valObj.value + ' ' +
         this._getDateRangeEnum(valObj.value, valObj.range);
      }else{
        var whereDates = this._getDisplayDates(valObj, type);
        if (type.indexOf("Between") > 0) {
          whereClause = this.filterBuilderNls[type] + ' ' + whereDates.value1 + ' ' + this.filterBuilderNls.and + ' ' +
           whereDates.value2;
        }else if(type.indexOf('Blank') > 0){
          whereClause = this.filterBuilderNls[type];
        }else{
          whereClause = this.filterBuilderNls[type] + ' ' + whereDates.value;
        }
      }
      return fName + ' ' + whereClause;
    },

    _getDateRangeEnum: function(value, range){
      var _rangeDateEnum = {
        'dateOperatorYears': 'year',
        'dateOperatorDays': 'day',
        'dateOperatorMonths': 'month',
        'dateOperatorWeeks': 'week',
        'dateOperatorHours': 'hour',
        'dateOperatorMinutes': 'minute'
      };
      range = _rangeDateEnum[range];
      return window.jimuNls.timeUnit[value > 1 ? range + 's' : range].toLowerCase();
    },

    _convertRangeToDays: function(rangeCount, rangeType) {
      var days = rangeCount;  // this.OPERATORS.dateOperatorDays

      if (rangeType === this.OPERATORS.dateOperatorYears) {
        // not accurate; same as AGOL approach
        days = rangeCount * 365;
      } else if (rangeType === this.OPERATORS.dateOperatorMonths) {
        // not accurate; same as AGOL approach
        days = rangeCount * 30;
      } else if (rangeType === this.OPERATORS.dateOperatorWeeks) {
        days = rangeCount * 7;
      } else if (rangeType === this.OPERATORS.dateOperatorHours) {
        days = rangeCount / 24;
      } else if (rangeType === this.OPERATORS.dateOperatorMinutes) {
        days = rangeCount / (24 * 60);
      }

      // Round days to 6 decimal places--enough for one minute (0.000694 days)
      days = Math.round(days * 1000000) / 1000000;

      return days;
    },

    formatDate: function(value){
      var date = new Date(value);
      return "" + date.getUTCFullYear() + "-" +
        dojoNumber.format(date.getUTCMonth() + 1, {pattern: "00"}) + "-" +
        dojoNumber.format(date.getUTCDate(), {pattern: "00"}) + " " +
        dojoNumber.format(date.getUTCHours(), {pattern: "00"}) + ":" +
        dojoNumber.format(date.getUTCMinutes(), {pattern: "00"}) + ":" +
        dojoNumber.format(date.getUTCSeconds(), {pattern: "00"});
    },

    addDay: function(date){
      return new Date(date.getTime() + this.dayInMS);
    },
    addHour: function(date){
      return new Date(date.getTime() + this.HourInMS);
    },
    addMinute: function(date){
      return new Date(date.getTime() + this.MinuteInMS);
    },
    addSec: function(date){
      return new Date(date.getTime() + this.SecInMS);
    },

    /**************************************************/
    /****  parse                                   ****/
    /**************************************************/
    //expr->partsObj
    //expr->partsObj, parse sql expression to json partsObj
    //if we can parse the expr successfully, the function returns a object
    //otherwise, null or undefined is returned
    getFilterObjByExpr: function(defExpr){
      if (!defExpr || !this.fieldsStore) {
        return;
      }

      var obj = this.replaceStrings(defExpr);
      defExpr = obj.defExpr;

      var partsObj = this.findParts(defExpr, "AND");
      if (partsObj.parts.length === 1) {
        partsObj = this.findParts(defExpr, "OR");
        if (partsObj.parts.length === 1) {
          // just a simple expression
          partsObj.logicalOperator = "AND";
        }
      }

      // only 2 levels
      array.forEach(partsObj.parts, function(part){
        part.expr = part.expr.trim();
        if (part.expr.startsWith('(') && (part.expr.search(/\)$/) > -1)) {
          // part.expr.endsWith(')') -> Invalid regular expression: /)$/: Unmatched ')'
          // (field = 1 AND field = 2)
          // (field = 1) AND (field = 2)
          var str = part.expr.substring(1, part.expr.length - 1);
          var pos1 = str.indexOf('(');
          var pos2 = str.indexOf(')');
          if ((pos1 === -1 && pos2 === -1) || pos1 < pos2) {
            part.expr = str;
          }
        }

        var subPartsObj = this.findParts(part.expr, "AND");
        if (subPartsObj.parts.length === 1) {
          subPartsObj = this.findParts(part.expr, "OR");
        }
        if (subPartsObj.parts.length > 1) {
          part.parts = subPartsObj.parts;
          part.logicalOperator = subPartsObj.logicalOperator;
        }
      }, this);

      this.parseExpr(partsObj);

      //Portal code
      this.reReplaceStrings(obj, partsObj, lang.hitch(this, function(){
        //WAB Code
        if(partsObj && partsObj.parts){
          array.forEach(partsObj.parts, lang.hitch(this, function(partOrParts) {
            if (partOrParts) {
              if (partOrParts.parts) {
                //handle expression set
                array.forEach(partOrParts.parts, lang.hitch(this, function(singlePart) {
                  //parse numbers
                  this._handleParsedValuesForSinglePart(singlePart);
                  //add 'value' type if value type is missing
                  this._addDefalutValueTypeForSinglePart(singlePart);
                }));
              } else {
                //handle single expression
                //parse numbers
                this._handleParsedValuesForSinglePart(partOrParts);
                //add 'value' type if value type is missing
                this._addDefalutValueTypeForSinglePart(partOrParts);
              }
            }
          }));
        }
      }));

      //WAB Code
      //We need to check if the partsObj has error info or not.
      if(this.isPartsObjHasError(partsObj)){
        //invalid partsObj
        partsObj = null;
      }

      return partsObj;
    },

    //handle number values
    _handleParsedValuesForSinglePart: function(singlePart){
      if(singlePart){
        if(singlePart.fieldObj && singlePart.fieldObj.shortType === 'number'){
          if(singlePart.valueObj){
            if(singlePart.valueObj.hasOwnProperty('value')){
              singlePart.valueObj.value = parseFloat(singlePart.valueObj.value);
            }
            if(singlePart.valueObj.hasOwnProperty('value1')){
              singlePart.valueObj.value1 = parseFloat(singlePart.valueObj.value1);
            }
            if(singlePart.valueObj.hasOwnProperty('value2')){
              singlePart.valueObj.value2 = parseFloat(singlePart.valueObj.value2);
            }
          }
        }
      }
    },

    //add defalut 'type' property for valueObj if it is missing.
    _addDefalutValueTypeForSinglePart: function(singlePart){
      if(singlePart && singlePart.valueObj){
        if(!singlePart.valueObj.type){
          singlePart.valueObj.type = 'value';
        }
      }
    },

    replaceStrings: function(defExpr){
      var origDefExpr = defExpr;

      // remove all strings from defExpr so parsing is easier
      // 'Bob' / '''Bob' / 'Bob''' / 'Bob''Fred' / ''
      var getEnd = function(defExpr, start, pos){
        var end = -1;
        var pos2;
        if (pos === start + 1) {
          pos2 = defExpr.indexOf("'", pos + 1);
          if (pos2 === pos + 1) {
            // single quotes inside string
            end = defExpr.indexOf("'", pos2 + 1);
            return getEnd(defExpr, start, end);
          } else {
            // end of string
            end = pos;
          }
        } else {
          pos2 = defExpr.indexOf("'", pos + 1);
          if (pos2 === pos + 1) {
            // single quotes inside string
            end = defExpr.indexOf("'", pos2 + 1);
            return getEnd(defExpr, start, end);
          } else {
            // end of string
            end = pos;
          }
        }
        return end;
      };

      var savedStrings = [];
      var pos = defExpr.indexOf("'");
      while (pos > -1) {
        var start = pos;
        var end = defExpr.indexOf("'", pos + 1);
        var endAdd = 0;
        end = getEnd(defExpr, start, end);
        if (defExpr[start + 1] === '%') {
          start++;
        }
        if (defExpr[end - 1] === '%') {
          end = end - 1;
          endAdd++;
        }
        var string = defExpr.substring(start + 1, end);

        // non-latin strings have to start with N; supported only on hosted FS
        if (defExpr[start - 1] === 'N') {
          defExpr = defExpr.substring(0, start - 1) + defExpr.substring(start);
          start = start - 1;
          end = end - 1;
        }

        if (!this.isDateString(string) && string.indexOf("{") === -1) {
          // no dates and no parameterized values
          savedStrings.push(string);
          defExpr = defExpr.substring(0, start + 1) + "#" +
           (savedStrings.length - 1) + "#" + defExpr.substring(end);
          pos = defExpr.indexOf("'", (defExpr.lastIndexOf('#') + 2 + endAdd));
        } else {
          pos = defExpr.indexOf("'", end + 1 + endAdd);
        }
      }

      return {
        origDefExpr: origDefExpr,
        defExpr: defExpr,
        savedStrings: savedStrings
      };
    },

    reReplaceStrings: function(obj, partsObj, /*optional*/ callback){
      var savedStrings = obj.savedStrings;
      if (!savedStrings.length) {
        //WAB Code
        if(callback && typeof callback === 'function'){
          callback();
        }
        return;
      }

      if (savedStrings.length) {
        // put the strings back in
        var replace = function (part, savedStrings) {
          if (part.valueObj === undefined ||
            part.valueObj === null) {
            return false;
          }
          if (part.valueObj.value === undefined ||
            part.valueObj.value === null) {
            return false;
          }
          if (part.fieldObj.shortType !== "string") {
            return false;
          }
          var start = part.valueObj.value.indexOf("#");
          var end = part.valueObj.value.lastIndexOf("#");
          if (esriLang.isDefined(part.valueObj.value) && start > -1) {
            part.valueObj.value =
              savedStrings[parseInt(part.valueObj.value.substring(start + 1, end), 10)]
              .replace(/\'\'/g, "'");
            this.builtSingleFilterString(part);
            return true;
          }
          return false;
        };
        replace = lang.hitch(this, replace);

        var replaced = false;
        array.forEach(partsObj.parts, function(part){
          if (part.parts) {
            // set
            var setReplaced = false;
            array.forEach(part.parts, function(subPart){
              // expr
              setReplaced = replace(subPart, savedStrings) || setReplaced;
            });
            if (setReplaced) {
              replaced = setReplaced;
              part.expr = this.builtFilterString(part);
            }
          } else {
            // expr
            replaced = replace(part, savedStrings) || replaced;
            if (replaced) {
              this.builtFilterString(part);
            }
          }
        }, this);

        //WAB Code
        if(callback && typeof callback === 'function'){
          callback();
        }

        //Portal Code
        if (replaced) {
          partsObj.expr = null;
          this.getExprByFilterObj(partsObj);
        }
      }
    },

    isDateString: function(string){
      // 2012-12-21 00:00:00
      if (string.length === 19 &&
      string.charAt(4) === '-' &&
      string.charAt(7) === '-' &&
      string.charAt(10) === ' ' &&
      string.charAt(13) === ':' &&
      string.charAt(16) === ':') {
        return true;
      }
      return false;
    },

    findParts: function(defExpr, logicalOperator){
      var lowerDefExpr = defExpr.toLowerCase();
      var conStr = " " + logicalOperator.toLowerCase() + " ";
      var parts = [];
      var lastPos = 0;
      var pos = lowerDefExpr.indexOf(conStr);
      while (pos > 0) {
        var str = defExpr.substring(lastPos, pos);
        var lowerStr = str.toLowerCase();
        // TODO don't count parenthesis within a string ....
        // TODO don't check between within a string ....
        var oB = str.count('(');
        var cB = str.count(')');
        // single quotes within a string are used as 2 single quotes
        var sQ = str.count('\'');
        if (oB !== cB || sQ % 2 === 1) {
          // we don't have the full part
          pos = lowerDefExpr.indexOf(conStr, pos + 1);
        } else if (lowerStr.indexOf(" between ") > -1 && lowerStr.indexOf(" and ") === -1) {
          pos = lowerDefExpr.indexOf(conStr, pos + 1);
        } else {
          parts.push({
            expr: str
          });
          lastPos = pos + conStr.length;
          pos = lowerDefExpr.indexOf(conStr, lastPos);
        }
      }
      parts.push({
        expr: defExpr.substring(lastPos)
      });

      // make sure all parts have operators; if not add the part to the previous part
      var len = parts.length;
      for (var i = len - 1; i >= 0; i--) {
        if (!this.hasOperator(parts[i].expr) && i > 0) {
          parts[i - 1].expr += " " + logicalOperator + " " + parts[i].expr;
          parts.splice(i, 1);
        }
      }

      return {
        expr: defExpr,
        parts: parts,
        logicalOperator: logicalOperator
      };
    },

    hasOperator: function(str){
      str = str.toLowerCase();

      if (str.indexOf("{") > -1 && str.indexOf("}") > -1) {
        // parameterized def Expr
        return true;
      } else if (str.indexOf(" = ") > -1 ||
      str.indexOf(" < ") > -1 ||
      str.indexOf(" > ") > -1 ||
      str.indexOf(" <> ") > -1 ||
      str.indexOf(" <= ") > -1 ||
      str.indexOf(" >= ") > -1 ||
      str.indexOf(" like ") > -1 ||
      //str.indexOf(" not like ") > -1 ||
      str.indexOf(" between ") > -1 ||
      str.indexOf(" date") > -1 ||
      //str.indexOf(" not between ") > -1 ||
      str.indexOf(" is null") > -1 ||
      str.indexOf(" is not null") > -1) {
        return true;
      }
      return false;
    },

    parseExpr: function(partsObj){
      array.forEach(partsObj.parts, function(part){
        if (part.parts) {
          this.parseExpr(part);
        } else {
          this.parseSingleExpr(part);
        }
      }, this);
    },

    //code for wab
    _preParseSingleExpr: function(_part) {
      // part: {expr: "<str>"}
      // {expr: "LOWER(CITY_NAME) LIKE LOWER('%#0#%')"}
      //expr:
      //for not hosted service
      // LOWER(County) LIKE LOWER('shijingshan%')
      // LOWER(County) LIKE LOWER('%shijingshan')
      // LOWER(County) LIKE LOWER('%shijingshan%')
      // LOWER(County) NOT LIKE LOWER('%shijingshan%')
      //for hosted service(maybe doesn't has prefix N)
      // LOWER(County) LIKE LOWER(N'石景山区%')
      // LOWER(County) LIKE LOWER(N'%石景山区')
      // LOWER(County) LIKE LOWER(N'%石景山区%')
      // LOWER(County) NOT LIKE LOWER(N'%石景山区%')
      var part = null;
      try {
        part = lang.clone(_part);
        part.expr = part.expr.trim();

        //str: CITY_NAME LIKE '%#0#%'
        var regIgnoreCaseLike = /^LOWER\((.*)\)(\s+|\s+NOT\s+)LIKE\s+LOWER\(N?'(.*)'\)$/i;
        //LOWER(CITY_NAME) LIKE LOWER('%BEIJING%') or LOWER(CITY_NAME) LIKE LOWER(N'%北京%')
        if (regIgnoreCaseLike.test(part.expr)) {
          var fieldName = '';
          var value = '';
          var reg1 = /^LOWER\((.*)\)\s+/i;
          var match1 = part.expr.match(reg1);

          if (match1 && match1.length >= 2) {
            fieldName = match1[1]; //CITY_NAME
          } else {
            return null;
          }

          var reg2 = /LOWER\(N?'(.*)'\)$/i;
          var match2 = part.expr.match(reg2);

          if (match2 && match2.length >= 2) {
            value = "'" + match2[1] + "'"; //'%#0#%'
          } else {
            return null;
          }

          part.expr = part.expr.replace(/^LOWER\((.*)\)\s+/i, fieldName + ' ');
          part.expr = part.expr.replace(/LOWER\(N?'(.*)'\)$/i, value);
          part.caseSensitive = false;
          //return part;
        }
        else{
          var regCaseSensitive = /^(.+)(\s+|\s+NOT\s+)LIKE\s+N?'(.*)'$/i;
          if(regCaseSensitive.test(part.expr)){
            part.caseSensitive = true;
            //return part;
          }
        }
      } catch (e) {
        console.log(e);
        return null;
      }

      if(part){
        if(this.isHosted){
          part.caseSensitive = false;
        }
      }

      return part;
    },

    _removeOperator: function(shortType, str, operatorSize) {
      //PR 8530
      var timestamp = "timestamp ";
      str = str.substring(operatorSize).trim();  // remove operator

      // Remove "timestamp" flag for non-hosted sources
      if (shortType === "date" && !this.isHosted && str.toLowerCase().startsWith(timestamp)) {
        // timestamp '2014-01-01'
        str = str.substring(timestamp.length).trim();
      }

      return str;
    },

    parseSingleExpr: function(part){
      //code for wab, try handle with case sensitive
      //samples: {expr: "LOWER(CITY_NAME) LIKE LOWER('%#0#%')"}
      //start
      var parsedPart = this._preParseSingleExpr(part);
      if(parsedPart){
        part = lang.mixin(part, parsedPart);
      }
      //end

      // part: {expr: "<str>"}
      // {"expr":"CITY_NAME = '#0#'"}
      // {"expr": "CITY_NAME LIKE '%#0#%'"}
      var str = part.expr.trim();
      var pos = str.indexOf(" ");
      var fieldName = str.substring(0, pos);
      part.fieldObj = {
        name: fieldName
      };
      part.valueObj = {};// value, value1, value2, type, period
      this.getFieldItemByName({
        name: fieldName
      }, function(item){
        part.fieldObj.shortType = item.shortType[0];
        part.fieldObj.label = item.label[0];
      }, function(){
        part.error = {
          msg: "unknown field name (" + fieldName + ")",
          code: 1
        };
      });
      str = str.substring(pos + 1).trim();
      var lStr = str.toLowerCase();

      if (lStr.startsWith("= ")) {
        str = this._removeOperator(part.fieldObj.shortType, str, "= ".length);

        this.storeValue(str, part);//this.storeValue(str.substring(2).trim(), part);
        if (part.fieldObj.shortType === "date") {
          part.operator = this.OPERATORS.dateOperatorIsOn;
        } else if (part.fieldObj.shortType === "string") {
          part.operator = this.OPERATORS.stringOperatorIs;
        } else { // number
          part.operator = this.OPERATORS.numberOperatorIs;
        }

      } else if (lStr.startsWith("< ")) {
        str = this._removeOperator(part.fieldObj.shortType, str, "< ".length);

        this.storeValue(str, part);//this.storeValue(str.substring(2).trim(), part);
        if (part.fieldObj.shortType === "date") {
          part.operator = this.OPERATORS.dateOperatorIsBefore;
        } else if (part.fieldObj.shortType === "number") {
          part.operator = this.OPERATORS.numberOperatorIsLessThan;
        } else {
          part.error = {
            msg: "operator (" + lStr + ") not supported for string",
            code: 3
          };
        }

      } else if (lStr.startsWith("> ")) {
        str = this._removeOperator(part.fieldObj.shortType, str, "> ".length);

        this.storeValue(str, part);//this.storeValue(str.substring(2).trim(), part);
        if (part.fieldObj.shortType === "date") {
          part.operator = this.OPERATORS.dateOperatorIsAfter;
        } else if (part.fieldObj.shortType === "number") {
          part.operator = this.OPERATORS.numberOperatorIsGreaterThan;
        } else {
          part.error = {
            msg: "operator (" + lStr + ") not supported for string",
            code: 3
          };
        }

      } else if (lStr.startsWith("<> ")) {
        str = this._removeOperator(part.fieldObj.shortType, str, "<> ".length);

        this.storeValue(str, part);//this.storeValue(str.substring(3).trim(), part);
        if (part.fieldObj.shortType === "date") {
          part.operator = this.OPERATORS.dateOperatorIsNotOn;
        } else if (part.fieldObj.shortType === "string") {
          part.operator = this.OPERATORS.stringOperatorIsNot;
        } else { // number
          part.operator = this.OPERATORS.numberOperatorIsNot;
        }

      } else if (lStr.startsWith("<= ")) {
        str = this._removeOperator(part.fieldObj.shortType, str, "<= ".length);

        this.storeValue(str, part);
        if (part.fieldObj.shortType === "date") {
          part.operator = this.OPERATORS.dateOperatorIsOnOrBefore;
        } else if (part.fieldObj.shortType === "number") {
          part.operator = this.OPERATORS.numberOperatorIsAtMost;
        } else {
          part.error = {
            msg: "operator (" + lStr + ") not supported for string",
            code: 3
          };
        }

      } else if (lStr.startsWith(">= ")) {
        str = this._removeOperator(part.fieldObj.shortType, str, ">= ".length);

        this.storeValue(str, part);
        if (part.fieldObj.shortType === "date") {
          part.operator = this.OPERATORS.dateOperatorIsOnOrAfter;
        } else if (part.fieldObj.shortType === "number") {
          part.operator = this.OPERATORS.numberOperatorIsAtLeast;
        } else {
          part.error = {
            msg: "operator (" + lStr + ") not supported for string",
            code: 3
          };
        }

      } else if (lStr.startsWith("like ")) {

        // only string fields
        str = str.substring(5).trim();
        if (str.startsWith('N\'')) {
          str = str.substring(1, str.length);
        }
        if (str.startsWith('\'%') && str.endsWith('%\'')) {
          this.storeValue(str.substring(2, str.length - 2), part);
          part.operator = this.OPERATORS.stringOperatorContains;
        } else if (str.startsWith('\'%') && str.endsWith('\'')) {
          this.storeValue(str.substring(2, str.length - 1), part);
          part.operator = this.OPERATORS.stringOperatorEndsWith;
        } else if (str.startsWith('\'') && str.endsWith('%\'')) {
          this.storeValue(str.substring(1, str.length - 2), part);
          part.operator = this.OPERATORS.stringOperatorStartsWith;
        } else {
          part.error = {
            msg: "value (" + lStr + ") not supported for LIKE",
            code: 3
          };
        }

      } else if (lStr.startsWith("not like ")) {

        // only string fields
        str = str.substring(9).trim();
        if (str.startsWith('N\'')) {
          str = str.substring(1, str.length);
        }
        if (str.startsWith('\'%') && str.endsWith('%\'')) {
          //this.storeValue(str.substring(1, str.length - 2), part);
          this.storeValue(str.substring(2, str.length - 2), part);
          part.operator = this.OPERATORS.stringOperatorDoesNotContain;
        } else {
          part.error = {
            msg: "value (" + lStr + ") not supported for NOT LIKE",
            code: 3
          };
        }

      } else if (lStr.startsWith("between ")) {
        this._updatePartForBetween(str, true, part);

      } else if (lStr.startsWith("not between ")) {
        this._updatePartForBetween(str, false, part);

      } else if (lStr === "is null") {

        part.valueObj.value = null;
        if (part.fieldObj.shortType === "date") {
          part.operator = this.OPERATORS.dateOperatorIsBlank;
        } else if (part.fieldObj.shortType === "string") {
          part.operator = this.OPERATORS.stringOperatorIsBlank;
        } else { // number
          part.operator = this.OPERATORS.numberOperatorIsBlank;
        }

      } else if (lStr === "is not null") {

        part.valueObj.value = null;
        if (part.fieldObj.shortType === "date") {
          part.operator = this.OPERATORS.dateOperatorIsNotBlank;
        } else if (part.fieldObj.shortType === "string") {
          part.operator = this.OPERATORS.stringOperatorIsNotBlank;
        } else { // number
          part.operator = this.OPERATORS.numberOperatorIsNotBlank;
        }

      } else {
        part.error = {
          msg: "unknown operator (" + lStr + ")",
          code: 2
        };
      }

      if ((esriLang.isDefined(part.valueObj.value) && (typeof part.valueObj.value === "string") &&
        part.valueObj.value.startsWith("{") && part.valueObj.value.endsWith("}")) ||
      (esriLang.isDefined(part.valueObj.value1) && (typeof part.valueObj.value1 === "string") &&
        part.valueObj.value1.startsWith("{") && part.valueObj.value1.endsWith("}"))) {
        // value2 is same as value1, we don't need to check
        part.isInteractive = true;
      }

      // {
      //   "expr": "CITY_NAME LIKE '#0#%'",
      //   "fieldObj": {
      //     "name": "CITY_NAME",
      //     "shortType": "string",
      //     "label": "CITY_NAME"
      //   },
      //   "valueObj": {
      //     "value": "#0#"
      //   },
      //   "operator": "stringOperatorStartsWith"
      // }
    },

    getFieldItemByName: function(query, handler, errorHandler){
      this.fieldsStore.fetch({
        query: query,
        onComplete: lang.hitch(this, function(items){
          if (items && items.length) {
            handler(items[0]);
          } else {
            errorHandler();
          }
        })
      });
    },

    subtractDay: function(date){
      return new Date(date.getTime() - this.dayInMS);
    },

    /**
     * Parses a single BETWEEN or NOT BETWEEN expression.
     * @param {string} str Expression to parse
     * @param {boolean} isBetween Indicates if expression to be handled as BETWEEN (true) or NOT BETWEEN (false)
     * @param {object} part Parsed expression; input uses part.fieldObj.shortType; output produces part.operator,
     * part.valueObj, part.error
     */
    _updatePartForBetween: function (str, isBetween, part) {
      // Supported cases:
      // ["NOT "] "BETWEEN <number> AND <number>"
      // ["NOT "] "BETWEEN <param> AND <param>"  parameterized
      // ["NOT "] "BETWEEN <datestring> AND <datestring>"  not hosted
      // ["NOT "] "BETWEEN timestamp <datestring> AND timestamp <datestring>"  hosted
      // ["NOT "] "BETWEEN CURRENT_TIMESTAMP - <number> AND CURRENT_TIMESTAMP"
      var pos, left, right, rangeType, testRangeCount, rangeCount, epsilon = 0.0001,
        betweenPrefix = isBetween ? "between " : "not between ";

      // Remove "between " (isBetween true) or "not between" (otherwise) and, if present, "timestamp " from beginning
      str = this._removeOperator(part.fieldObj.shortType, str, betweenPrefix.length);

      // "AND" separator is required
      pos = str.toLowerCase().indexOf(" and ");
      if (pos > -1) {
        left = str.substring(0, pos).trim();

        // Pull out "in the last..." operator
        if (left.startsWith("CURRENT_TIMESTAMP ")) {
          left = left.substring("CURRENT_TIMESTAMP ".length).trim();
          if (left.startsWith("-")) {
            part.operator = isBetween ? this.OPERATORS.dateOperatorInTheLast : this.OPERATORS.dateOperatorNotInTheLast;
            try {
              // Guess rangeType by finding integer number of range units. Can't tell difference between 1 month and
              // 30 days, however, or 1 year and 365 days.
              rangeCount = parseFloat(left.substring(1).trim());

              if (rangeCount >= 1) {
                // days, weeks, months, years
                rangeType = this.OPERATORS.dateOperatorDays;
                testRangeCount = rangeCount / 365;
                if (Math.abs(testRangeCount - Math.round(testRangeCount)) < epsilon) {
                  rangeCount = Math.round(testRangeCount);
                  rangeType = this.OPERATORS.dateOperatorYears;
                } else {
                  testRangeCount = rangeCount / 30;
                  if (Math.abs(testRangeCount - Math.round(testRangeCount)) < epsilon) {
                    rangeCount = Math.round(testRangeCount);
                    rangeType = this.OPERATORS.dateOperatorMonths;
                  } else {
                    testRangeCount = rangeCount / 7;
                    if (Math.abs(testRangeCount - Math.round(testRangeCount)) < epsilon) {
                      rangeCount = Math.round(testRangeCount);
                      rangeType = this.OPERATORS.dateOperatorWeeks;
                    }
                  }
                }
              } else {
                // hours, minutes
                rangeType = this.OPERATORS.dateOperatorMinutes;
                rangeCount *= 24;
                if (Math.abs(rangeCount - Math.round(rangeCount)) < epsilon) {
                  rangeType = this.OPERATORS.dateOperatorHours;
                } else {
                  rangeCount *= 60;
                }
              }

              part.valueObj.value = rangeCount;
              part.valueObj.range = rangeType;
            } catch (ignore) {
              part.error = {
                msg: "missing count for '" + (isBetween ? "" : "not ") + "in the last'",
                code: 3
              };
            }
          } else {
            part.error = {
              msg: "'" + (isBetween ? "" : "not ") + "in the next' not supported",
              code: 3
            };
          }

        } else {
          // Remove " and " and, if present, "timestamp " from beginning of part after AND
          right = this._removeOperator(part.fieldObj.shortType, str.substring(pos), " and ".length);

          this.storeValue1(left, part);
          this.storeValue2(right, part);

          if (part.fieldObj.shortType === "date") {
            part.operator = isBetween ? this.OPERATORS.dateOperatorIsBetween : this.OPERATORS.dateOperatorIsNotBetween;

            // Check for case where values are Dates 24 hours apart--they're used as a range for "on"
            if (typeof part.valueObj.value1 === "object" && typeof part.valueObj.value2 === "object") {
              try {
                if (Math.abs(this.subtractDay(part.valueObj.value2).getTime() -
                                              part.valueObj.value1.getTime()) < 1000) {
                  part.valueObj.value = part.valueObj.value1;
                  delete part.valueObj.value1;
                  delete part.valueObj.value2;
                  part.operator = isBetween ? this.OPERATORS.dateOperatorIsOn : this.OPERATORS.dateOperatorIsNotOn;
                }
              } catch (ignore) {
              }
            }
          } else if (part.fieldObj.shortType === "number" || part.fieldObj.shortType === "oid") {
            part.operator =
              isBetween ? this.OPERATORS.numberOperatorIsBetween : this.OPERATORS.numberOperatorIsNotBetween;
          } else {
            part.error = {
              msg: part.fieldObj.shortType + " field not supported for " + (isBetween ? "" : "NOT ") + "BETWEEN",
              code: 3
            };
          }
        }

      } else {
        part.error = {
          msg: "missing AND operator for " + (isBetween ? "" : "NOT ") + "BETWEEN",
          code: 3
        };
      }
    },

    storeValue: function(str, part){

      if (str.startsWith('{') && str.endsWith('}')) {
        // interactive placeholder
        part.valueObj.value = str;
      } else if (str.startsWith('\'{') && str.endsWith('}\'')) {
        // interactive placeholder
        part.valueObj.value = str.substring(1, str.length - 1);
      } else if (part.fieldObj.shortType === "date") {
        if (str.startsWith('\'') && str.endsWith('\'')) {
          var dateStr = str.substring(1, str.length - 1);
          part.valueObj.value = this.parseDate(dateStr);
          //console.log("dateStr "+dateStr+" to Date "+part.valueObj.value.toString());
        } else {
          part.valueObj.value = str;
          part.valueObj.type = 'field';
        }
      } else if (part.fieldObj.shortType === "string") {
        if ((str.startsWith('#') || str.startsWith('%#')) &&
            (str.endsWith('#') || str.endsWith('#%'))) {
          part.valueObj.value = str;
        } else if (str.startsWith('\'') && str.endsWith('\'')) {
          part.valueObj.value = str.substring(1, str.length - 1).replace(/\'\'/g, "'");
        } else {
          part.valueObj.value = str;
          part.valueObj.type = 'field';
          this.getFieldItemByName({
            name: str
          }, function(item){
            part.valueObj.label = item.label[0];
          }, function(){
            part.error = {
              msg: "unknown field name (" + str + ")",
              code: 1
            };
          });
        }
      } else { // number
        part.valueObj.value = str;
        if (isNaN(str)) {
          part.valueObj.type = 'field';
          this.getFieldItemByName({
            name: str
          }, function(item){
            part.valueObj.label = item.label[0];
          }, function(){
            part.error = {
              msg: "unknown field name (" + str + ")",
              code: 1
            };
          });
        }
      }
    },

    storeValue1: function(str, part){
      // not for string fields

      if (str.startsWith('{') && str.endsWith('}')) {
        // interactive placeholder
        part.valueObj.value1 = str;
      } else if (str.startsWith('\'{') && str.endsWith('}\'')) {
        // interactive placeholder
        part.valueObj.value1 = str.substring(1, str.length - 1);
      } else if (part.fieldObj.shortType === "date") {
        if (str.startsWith('\'') && str.endsWith('\'')) {
          var dateStr = str.substring(1, str.length - 1);
          part.valueObj.value1 = this.parseDate(dateStr);
          //console.log("dateStr "+dateStr+" to Date "+part.valueObj.value.toString());
        } else {
          part.valueObj.value1 = str;
          part.valueObj.type = 'field';
        }
      } else { // number
        part.valueObj.value1 = str;
        if (isNaN(str)) {
          part.valueObj.type = 'field';
        }
      }
    },

    storeValue2: function(str, part){
      // not for string fields

      if (str.startsWith('{') && str.endsWith('}')) {
        // interactive placeholder
        part.valueObj.value2 = str;
      } else if (str.startsWith('\'{') && str.endsWith('}\'')) {
        // interactive placeholder
        part.valueObj.value2 = str.substring(1, str.length - 1);
      } else if (part.fieldObj.shortType === "date") {
        if (str.startsWith('\'') && str.endsWith('\'')) {
          var dateStr = str.substring(1, str.length - 1);
          part.valueObj.value2 = this.parseDate(dateStr);
          //console.log("dateStr "+dateStr+" to Date "+part.valueObj.value.toString());
        } else {
          part.valueObj.value2 = str;
          part.valueObj.type = 'field';
        }
      } else { // number
        part.valueObj.value2 = str;
        if (isNaN(str)) {
          part.valueObj.type = 'field';
        }
      }
    },

    parseDate: function(strValue){
      // we know strValue looks like this 'yyyy-MM-dd HH:mm:ss' (e.g. '2013-03-01 00:00:00')
      // some locals (e.g. en) expect a comma after the date like this '2013-03-01, 00:00:00'
      // de, e.g., does not use a comma like this '2013-03-01 00:00:00'
      // el, e.g., uses a dash like this '2013-03-01 - 00:00:00'
      // looked up in dojo/cldr/nls/<locale>/gregorian.js
      var date = locale.parse(strValue, {
        datePattern: "yyyy-MM-dd",
        timePattern: "HH:mm:ss"
      });
      if (!date) {
        date = locale.parse(strValue.replace(" ", ", "), {
          datePattern: "yyyy-MM-dd",
          timePattern: "HH:mm:ss"
        });
        if (!date) {
          date = locale.parse(strValue.replace(" ", " - "), {
            datePattern: "yyyy-MM-dd",
            timePattern: "HH:mm:ss"
          });
        }
      }
      return date;
    }
  });

  clazz.VIRTUAL_DATE_CUSTOM = 'custom';
  clazz.VIRTUAL_DATE_TODAY = 'today';
  clazz.VIRTUAL_DATE_YESTERDAY = 'yesterday';
  clazz.VIRTUAL_DATE_TOMORROW = 'tomorrow';
  clazz.VIRTUAL_DATE_THIS_WEEK = 'thisWeek';
  clazz.VIRTUAL_DATE_THIS_MONTH = 'thisMonth';
  clazz.VIRTUAL_DATE_THIS_QUARTER = 'thisQuarter';
  clazz.VIRTUAL_DATE_THIS_YEAR = 'thisYear';

  //check partsObj has 'ask for value' option or not
  clazz.isAskForValues = function(partsObj){
    var result = false;
    var parts = partsObj.parts;
    result = array.some(parts, function(item) {
      if (item.parts) {
        return array.some(item.parts, function(part) {
          return !!part.interactiveObj;
        });
      } else {
        return !!item.interactiveObj;
      }
    });
    return result;
  };

  //check partsObj has virtual date (like today, yesterday) or not
  clazz.hasVirtualDate = function(partsObj){
    var result = false;
    var parts = partsObj.parts;
    result = array.some(parts, function(item) {
      if (item.parts) {
        return array.some(item.parts, function(part) {
          return !!part.valueObj.virtualDate || !!part.valueObj.virtualDate1 || !!part.valueObj.virtualDate2;
        });
      } else {
        return !!item.valueObj.virtualDate || !!item.valueObj.virtualDate1 || !!item.valueObj.virtualDate2;
      }
    });
    return result;
  };

  //get real date by virtual date
  clazz.getRealDateByVirtualDate = function(virtualDate){
    var date = null;
    var currentDate = new Date();
    var currentTime = currentDate.getTime();
    var oneDayMillseconds = 24 * 60 * 60 * 1000;
    switch(virtualDate){
      case clazz.VIRTUAL_DATE_TODAY:
        date = currentDate;
        break;
      case clazz.VIRTUAL_DATE_YESTERDAY:
        date = new Date(currentTime - oneDayMillseconds);
        break;
      case clazz.VIRTUAL_DATE_TOMORROW:
        date = new Date(currentTime + oneDayMillseconds);
        break;
      case clazz.VIRTUAL_DATE_THIS_WEEK:
        date = [moment().startOf('week').toDate(), moment().endOf('week').toDate()];
        break;
      case clazz.VIRTUAL_DATE_THIS_MONTH:
        date = [moment().startOf('month').toDate(), moment().endOf('month').toDate()];
        break;
      case clazz.VIRTUAL_DATE_THIS_QUARTER:
        date = [moment().startOf('quarter').toDate(), moment().endOf('quarter').toDate()];
        break;
      case clazz.VIRTUAL_DATE_THIS_YEAR:
        date = [moment().startOf('year').toDate(), moment().endOf('year').toDate()];
        break;
      default:
        break;
    }
    return date;
  };

  // From https://docs.microsoft.com/en-us/previous-versions/windows/embedded/gg154758(v=winembedded.80)?redirectedfrom=MSDN
  clazz.TIMEZONE_DATA = {
    'Dateline Standard Time': { id: 0, offset: -12, displayName: '(UTC-12:00) International Date Line West' },
    'UTC-11': { id: 110, offset: -11, displayName: '(UTC-11:00) Coordinated Universal Time -11' },
    'Hawaiian Standard Time': { id: 200, offset: -10, displayName: '(UTC-10:00) Hawaii' },
    'Alaskan Standard Time': { id: 300, offset: -9, displayName: '(UTC-09:00) Alaska' },
    'Pacific Standard Time': { id: 400, offset: -8, displayName: '(UTC-08:00) Pacific Time (US and Canada)' },
    'Pacific Standard Time (Mexico)': { id: 410, offset: -8, displayName: '(UTC-08:00)Baja California' },
    'Mountain Standard Time': { id: 500, offset: -7, displayName: '(UTC-07:00) Mountain Time (US and Canada)' },
    'Mountain Standard Time (Mexico)': { id: 510, offset: -7, displayName: '(UTC-07:00) Chihuahua, La Paz, Mazatlan' },
    'US Mountain Standard Time': { id: 520, offset: -7, displayName: '(UTC-07:00) Arizona' },
    'Canada Central Standard Time': { id: 600, offset: -6, displayName: '(UTC-06:00) Saskatchewan' },
    'Central America Standard Time': { id: 610, offset: -6, displayName: '(UTC-06:00) Central America' },
    'Central Standard Time': { id: 620, offset: -6, displayName: '(UTC-06:00) Central Time (US and Canada)' },
    'Central Standard Time (Mexico)': { id: 630, offset: -6, displayName: '((UTC-06:00) Guadalajara, Mexico City, Monterrey' },
    'Eastern Standard Time': { id: 700, offset: -5, displayName: '(UTC-05:00) Eastern Time (US and Canada)' },
    'SA Pacific Standard Time': { id: 710, offset: -5, displayName: '(UTC-05:00) Bogota, Lima, Quito' },
    'US Eastern Standard Time': { id: 720, offset: -5, displayName: '(UTC-05:00) Indiana (East)' },
    'Venezuela Standard Time': { id: 840, offset: -3.5, displayName: '(UTC-04:30) Caracas' },
    'Atlantic Standard Time': { id: 800, offset: -4, displayName: '(UTC-04:00) Atlantic Time (Canada)' },
    'Central Brazilian Standard Time': { id: 810, offset: -4, displayName: '(UTC-04:00) Cuiaba' },
    'Pacific SA Standard Time': { id: 820, offset: -4, displayName: '(UTC-04:00) Santiago' },
    'SA Western Standard Time': { id: 830, offset: -4, displayName: '(UTC-04:00) Georgetown, La Paz, Manaus, San Juan' },
    'Paraguay Standard Time': { id: 850, offset: -4, displayName: '(UTC-04:00) Asuncion' },
    'Newfoundland Standard Time': { id: 900, offset: -2.5, displayName: '(UTC-03:30) Newfoundland' },
    'E. South America Standard Time': { id: 910, offset: -3, displayName: '(UTC-03:00) Brasilia' },
    'Greenland Standard Time': { id: 920, offset: -3, displayName: '(UTC-03:00) Greenland' },
    'Montevideo Standard Time': { id: 930, offset: -3, displayName: '(UTC-03:00) Montevideo' },
    'SA Eastern Standard Time': { id: 940, offset: -3, displayName: '(UTC-03:00) Cayenne, Fortaleza' },
    'Argentina Standard Time': { id: 950, offset: -3, displayName: '(UTC-03:00) Buenos Aires' },
    'Mid-Atlantic Standard Time': { id: 1000, offset: -2, displayName: '(UTC-02:00) Mid-Atlantic' },
    'UTC-2': { id: 1010, offset: -2, displayName: '(UTC-02:00) Coordinated Universal Time -02' },
    'Azores Standard Time': { id: 1100, offset: -1, displayName: '(UTC-01:00) Azores' },
    'Cabo Verde Standard Time': { id: 1110, offset: -1, displayName: '(UTC-01:00) Cabo Verde Is.' },
    'GMT Standard Time': { id: 1200, offset: 0, displayName: '(UTC) Dublin, Edinburgh, Lisbon, London' },
    'Greenwich Standard Time': { id: 1210, offset: 0, displayName: '(UTC) Monrovia, Reykjavik' },
    'Morocco Standard Time': { id: 1220, offset: 0, displayName: '(UTC) Casablanca' },
    'UTC': { id: 1230, offset: 0, displayName: '(UTC) Coordinated Universal Time' },
    'Central Europe Standard Time': { id: 1300, offset: 1, displayName: '(UTC+01:00) Belgrade, Bratislava, Budapest, Ljubljana, Prague' },
    'Central European Standard Time': { id: 1310, offset: 1, displayName: '(UTC+01:00) Sarajevo, Skopje, Warsaw, Zagreb' },
    'Romance Standard Time': { id: 1320, offset: 1, displayName: '(UTC+01:00) Brussels, Copenhagen, Madrid, Paris' },
    'W. Central Africa Standard Time': { id: 1330, offset: 1, displayName: '(UTC+01:00) West Central Africa' },
    'W. Europe Standard Time': { id: 1340, offset: 1, displayName: '(UTC+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna' },
    'Namibia Standard Time': { id: 1350, offset: 1, displayName: '(UTC+01:00) Windhoek' },
    'E. Europe Standard Time': { id: 1400, offset: 2, displayName: '(UTC+02:00) Minsk' },
    'Egypt Standard Time': { id: 1410, offset: 2, displayName: '(UTC+02:00) Cairo' },
    'FLE Standard Time': { id: 1420, offset: 2, displayName: '(UTC+02:00) Helsinki, Kyiv, Riga, Sofia, Tallinn, Vilnius' },
    'GTB Standard Time': { id: 1430, offset: 2, displayName: '(UTC+02:00) Athens, Bucharest' },
    'Israel Standard Time': { id: 1440, offset: 2, displayName: '(UTC+02:00) Jerusalem' },
    'Jordan Standard Time': { id: 1450, offset: 2, displayName: '(UTC+02:00) Amman' },
    'Middle East Standard Time': { id: 1460, offset: 2, displayName: '(UTC+02:00) Beirut' },
    'South Africa Standard Time': { id: 1470, offset: 2, displayName: '(UTC+02:00) Harare, Pretoria' },
    'Syria Standard Time': { id: 1480, offset: 2, displayName: '(UTC+02:00) Damascus' },
    'Turkey Standard Time': { id: 1490, offset: 2, displayName: '(UTC+02:00) Istanbul' },
    'Arab Standard Time': { id: 1500, offset: 3, displayName: '(UTC+03:00) Kuwait, Riyadh' },
    'Arabic Standard Time': { id: 1510, offset: 3, displayName: '(UTC+03:00) Baghdad' },
    'E. Africa Standard Time': { id: 1520, offset: 3, displayName: '(UTC+03:00) Nairobi' },
    'Kaliningrad Standard Time': { id: 1530, offset: 3, displayName: '(UTC+03:00) Kaliningrad' },
    'Iran Standard Time': { id: 1550, offset: 3.5, displayName: '(UTC+03:30) Tehran' },
    'Russian Standard Time': { id: 1540, offset: 4, displayName: '(UTC+04:00) Moscow, St. Petersburg, Volgograd' },
    'Arabian Standard Time': { id: 1600, offset: 4, displayName: '(UTC+04:00) Abu Dhabi, Muscat' },
    'Azerbaijan Standard Time': { id: 1610, offset: 4, displayName: '(UTC+04:00) Baku' },
    'Caucasus Standard Time': { id: 1620, offset: 4, displayName: '(UTC+04:00) Yerevan' },
    'Georgian Standard Time': { id: 1640, offset: 4, displayName: '(UTC+04:00) Tbilisi' },
    'Mauritius Standard Time': { id: 1650, offset: 4, displayName: '(UTC+04:00) Port Louis' },
    'Afghanistan Standard Time': { id: 1630, offset: 4.5, displayName: '(UTC+04:30) Kabul' },
    'West Asia Standard Time': { id: 1710, offset: 5, displayName: '(UTC+05:00) Tashkent' },
    'Pakistan Standard Time': { id: 1750, offset: 5, displayName: '(UTC+05:00) Islamabad, Karachi' },
    'India Standard Time': { id: 1720, offset: 5.5, displayName: '(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi' },
    'Sri Lanka Standard Time': { id: 1730, offset: 5.5, displayName: '(UTC+05:30) Sri Jayawardenepura' },
    'Nepal Standard Time': { id: 1740, offset: 5, displayName: '(UTC+05:45) Kathmandu' },
    'Ekaterinburg Standard Time': { id: 1700, offset: 6, displayName: '(UTC+06:00) Ekaterinburg' },
    'Central Asia Standard Time': { id: 1800, offset: 6, displayName: '(UTC+06:00) Astana' },
    'Bangladesh Standard Time': { id: 1830, offset: 6, displayName: '(UTC+06:00) Dhaka' },
    'Myanmar Standard Time': { id: 1820, offset: 6.5, displayName: '(UTC+06:30) Yangon (Rangoon)' },
    'N. Central Asia Standard Time': { id: 1810, offset: 7, displayName: '(UTC+07:00) Novosibirsk' },
    'SE Asia Standard Time': { id: 1910, offset: 7, displayName: '(UTC+07:00) Bangkok, Hanoi, Jakarta' },
    'North Asia Standard Time': { id: 1900, offset: 8, displayName: '(UTC+08:00) Krasnoyarsk' },
    'China Standard Time': { id: 2000, offset: 8, displayName: '(UTC+08:00) Beijing, Chongqing, Hong Kong, Urumqi' },
    'Singapore Standard Time': { id: 2020, offset: 8, displayName: '(UTC+08:00) Kuala Lumpur, Singapore' },
    'Taipei Standard Time': { id: 2030, offset: 8, displayName: '(UTC+08:00) Taipei' },
    'W. Australia Standard Time': { id: 2040, offset: 8, displayName: '(UTC+08:00) Perth' },
    'Ulaanbaatar Standard Time': { id: 2050, offset: 8, displayName: '(UTC+08:00) Ulaanbaatar' },
    'North Asia East Standard Time': { id: 2010, offset: 9, displayName: '(UTC+09:00) Irkutsk' },
    'Korea Standard Time': { id: 2100, offset: 9, displayName: '(UTC+09:00) Seoul' },
    'Tokyo Standard Time': { id: 2110, offset: 9, displayName: '(UTC+09:00) Osaka, Sapporo, Tokyo' },
    'AUS Central Standard Time': { id: 2130, offset: 9.5, displayName: '(UTC+09:30) Darwin' },
    'Cen. Australia Standard Time': { id: 2140, offset: 9.5, displayName: '(UTC+09:30) Adelaide' },
    'Yakutsk Standard Time': { id: 2120, offset: 10, displayName: '(UTC+10:00) Yakutsk' },
    'AUS Eastern Standard Time': { id: 2200, offset: 10, displayName: '(UTC+10:00) Canberra, Melbourne, Sydney' },
    'E. Australia Standard Time': { id: 2210, offset: 10, displayName: '(UTC+10:00) Brisbane' },
    'Tasmania Standard Time': { id: 2220, offset: 10, displayName: '(UTC+10:00) Hobart' },
    'West Pacific Standard Time': { id: 2240, offset: 10, displayName: '(UTC+10:00) Guam, Port Moresby' },
    'Vladivostok Standard Time': { id: 2230, offset: 11, displayName: '(UTC+11:00) Vladivostok' },
    'Central Pacific Standard Time': { id: 2300, offset: 11, displayName: '(UTC+11:00) Solomon Is., New Caledonia' },
    'Magadan Standard Time': { id: 2310, offset: 12, displayName: '(UTC+12:00) Magadan' },
    'Fiji Standard Time': { id: 2400, offset: 12, displayName: '(UTC+12:00) Fiji' },
    'New Zealand Standard Time': { id: 2410, offset: 12, displayName: '(UTC+12:00) Auckland, Wellington' },
    'UTC+12': { id: 2430, offset: 12, displayName: '(UTC+12:00) Coordinated Universal Time +12' },
    'Tonga Standard Time': { id: 2500, offset: 13, displayName: '(UTC+13:00) Nuku\'alofa' },
    'Samoa Standard Time': { id: 2510, offset: -11, displayName: '(UTC-11:00)Samoa'}
  };

  return clazz;
});