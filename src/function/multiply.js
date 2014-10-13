/**
 * @file 乘法
 * @author zhujl
 */
define(function (require, exports, module) {

    'use strict';

    var getDecimalLength = require('./getDecimalLength');

    /**
     * 乘法
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

        var factor = length > 0
                   ? 10 * length
                   : 1;

        return ((a * factor) * (b * factor)) / (factor * factor);

    };

});