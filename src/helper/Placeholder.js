/**
 * @file Placeholder
 * @author musicode
 */
define(function (require, exports, module) {

    'use strict';

    /**
     *
     * 各浏览器对 placeholder 的实现不一样：
     *
     * 1. IE9- 未实现
     * 2. Chrome, Firefox 等实现是聚焦时不隐藏 placeholder，输入时隐藏
     * 3. 某些奇葩浏览器貌似不能修改 placeholder 颜色
     *
     *
     * 需求一般有以下几种：
     *
     * 1. 为了提高性能，优先使用浏览器原生特性，低版本浏览器使用模拟实现
     * 2. 为了保证浏览器之间有相同的体验，最好使用模拟实现
     * 3. 如果希望修改 placeholder 颜色，必须使用模拟实现
     *
     */

    var isHidden = require('../function/isHidden');
    var toString = require('../function/toString');

    var inputUtil = require('../util/input');
    var detectionUtil = require('../util/detection');
    var lifeCycle = require('../util/lifeCycle');

    /**
     * 使输入框元素具有 placeholder 功能
     *
     * @constructor
     * @param {Object} options
     * @property {jQuery} options.mainElement 主元素，如文本框、密码框、文本域
     * @property {string=} options.mainTemplate 非模拟实现，此选项用处不大
     *                                          模拟实现时，如果 mainElement 结构不完整，可传入模版完善结构
     *
     * @property {string=} options.value 如果文字没写在元素属性（placeholder attribute）上，也可以传值
     *
     * @property {boolean=} options.nativeFirst 是否原生优先。支持 placeholder 的浏览器，不管其表现如何，优先使用原生
     *
     * @property {string=} options.labelSelector 模拟实现时，查找显示占位文本元素的选择器
     * @property {string=} options.inputSelector 模拟实现时，查找输入框元素的选择器
     * @property {Function=} options.showAnimation 模拟实现时，使用的显示动画
     * @property {Function=} options.hideAnimation 模拟实现时，使用的隐藏动画
     *
     * @property {Function=} options.onbeforeshow
     * @property {Function=} options.onaftershow
     * @property {Function=} options.onbeforehide
     * @property {Function=} options.onafterhide
     * @property {Function=} options.onbeforerender
     * @property {Function=} options.onafterrender
     */
    function Placeholder(options) {
        lifeCycle.init(this, options);
    }

    var proto = Placeholder.prototype;

    proto.type = 'Placeholder';

    proto.init = function () {

        var me = this;

        me.inner({
            proxy: me.option('nativeFirst') && detectionUtil.supportPlaceholder()
                 ? nativeProxy
                 : fakeProxy
        });

        executeProxyMethod(me, 'init');

        me.set({
            value: me.option('value')
        });

        me.state({
            hidden: me.option('hidden')
        });

    };

    proto.show = function () {
        this.state('hidden', false);
    };

    proto._show = function () {
        if (!this.is('hidden')) {
            return false;
        }
    };

    proto.hide = function () {
        this.state('hidden', true);
    };

    proto._hide = function () {
        if (this.is('hidden')) {
            return false;
        }
    };

    proto.render = function () {
        executeProxyMethod(this, 'render');
    };

    proto.dispose = function () {
        executeProxyMethod(this, 'dispose');
        lifeCycle.dispose(this);
    };

    lifeCycle.extend(proto);

    Placeholder.propertyUpdater = {
        value: function () {
            this.render();
        }
    };

    Placeholder.propertyValidator = {
        value: function (value) {
            value = toString(value, null);
            if (value == null) {
                value = this.inner('input').attr('placeholder');
            }
            return value || '';
        }
    };

    Placeholder.stateUpdater = {
        hidden: function (hidden) {
            executeProxyMethod(
                this,
                hidden ? 'hide' : 'show'
            );
        }
    };

    Placeholder.stateValidator = {
        hidden: function (hidden) {
            if ($.type(hidden) !== 'boolean') {
                hidden = executeProxyMethod(this, 'isHidden');
            }
            return hidden;
        }
    };







    function executeProxyMethod(instance, method) {
        var proxy = instance.inner('proxy');
        var fn = proxy[ method ];
        if (fn) {
            return fn(instance);
        }
    }

    var nativeProxy = {
        init: function (instance) {

            instance.initStructure();

            var mainElement = instance.option('mainElement');
            instance.inner({
                main: mainElement,
                input: mainElement
            });

        },
        render: function (instance) {

            instance.inner('input').attr(
                'placeholder',
                instance.get('value')
            );

        },
        isHidden: function (instance) {

            return instance.inner('input').val().length > 0;

        }
    };

    var fakeProxy = {
        init: function (instance) {

            instance.initStructure();

            var mainElement = instance.option('mainElement');
            var inputElement = mainElement.find(
                instance.option('inputSelector')
            );

            instance.inner({
                main: mainElement,
                input: inputElement,
                label: mainElement.find(
                    instance.option('labelSelector')
                )
            });

            inputUtil.init(inputElement);

            inputElement
                .on('input' + instance.namespace(), function () {
                    var hidden = $.trim(inputElement.val()).length > 0;
                    if (hidden !== instance.is('hidden')) {
                        // 为了触发 before 和 after 事件才调用实例方法
                        // 而不是 instance.state(hidden)
                        if (hidden) {
                            instance.hide();
                        }
                        else {
                            instance.show();
                        }
                    }
                });

        },
        show: function (instance) {

            instance.execute(
                'showAnimation',
                {
                    labelElement: instance.inner('label')
                }
            );

        },
        hide: function (instance) {

            instance.execute(
                'hideAnimation',
                {
                    labelElement: instance.inner('label')
                }
            );

        },
        render: function (instance) {

            var inputElement = instance.inner('input');
            inputElement.removeAttr('placeholder');

            instance.inner('label').html(
                instance.get('value')
            );

        },
        dispose: function (instance) {

            var inputElement = instance.inner('input');

            inputUtil.dispose(inputElement);
            inputElement.off(
                instance.namespace()
            );

        },
        isHidden: function (instance) {
            return isHidden(
                instance.inner('label')
            );
        }
    };


    return Placeholder;

});
