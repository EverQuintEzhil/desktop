import arithmetic from '../arithmetic';
import condition from '../condition';

import base64decode from './base64decode';
import base64encode from './base64encode';
import concat from './concat';
import currency from './currency';
import filter from './filter';
import length from './length';
import lodash from './lodash';
import map from './map';
import math from './math';
import max from './max';
import merge from './merge';
import min from './min';
import number from './number';
import object from './object';
import parseJSON from './parse-json';
import parseURL from './parse-url';
import project from './project';
import reduce from './reduce';
import removeKeys from './remove-keys';
import replace from './replace';
import reverse from './reverse';
import select from './select';
import splice from './splice';
import string from './string';
import stringifyJSON from './stringify-json';

const PipelineOperations = {
    arithmetic,
    base64decode,
    base64encode,
    concat,
    condition,
    currency,
    filter,
    length,
    lodash,
    map,
    math,
    max,
    merge,
    min,
    number,
    object,
    parseJSON,
    parseURL,
    project,
    reduce,
    removeKeys,
    replace,
    reverse,
    select,
    splice,
    string,
    stringifyJSON,
};

export default PipelineOperations;
