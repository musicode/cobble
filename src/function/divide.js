/**
 * @file 除法
 * @author zhujl
 */
define(function (require, exports, module) {

    'use strict';

    var getDecimalLength = require('./getDecimalLength');
    var float2Int = require('./float2Int');

    /**
     * 除法
     *
     * @param {number} a
     * @param {number} b
     * @return {number}
     */
    return function (a, b) {

        var length = Math.max(
                        getDecimalLength(a),
                        getDecimalLength(b)
                    );

        a = float2Int(a, length);
        b = float2Int(b, length);

        return a / b;

    };

});