/**
 * @file 可切换组件
 * @author zhujl
 */
define(function (require, exports, module) {

    'use strict';

    var lifeCycle = require('../function/lifeCycle');

    /**
     * 可切换组件
     *
     * @constructor
     * @param {Object} options
     * @property {jQuery} options.element
     * @property {number=} options.index 当前选中索引，默认是 0
     * @property {string=} options.trigger 触发方式，可选值有 over click，默认是 click
     * @property {string} options.selector 触发器的选择器
     * @property {string=} options.activeClass 触发元素被激活时的 class
     * @property {Function} options.change 切换动作
     * @argument {Object} options.change.data
     * @property {number} options.change.data.fromIndex
     * @property {number} options.change.data.toIndex
     */
    function Switchable(options) {
        return lifeCycle.init(this, options);
    }

    Switchable.prototype = {

        constructor: Switchable,

        type: 'Switchable',

        /**
         * 初始化
         */
        init: function () {

            var me = this;
            var element = me.element;
            var selector = me.selector;

            var index = me.index;
            var activeClass = me.activeClass;

            if ($.type(index) !== 'number' && activeClass) {
                index = element.find(selector)
                               .index(element.find('.' + me.activeClass));
            }

            var trigger = me.trigger;
            if (trigger === 'click') {
                element.on('click' + namespace, selector, me, onClick);
            }
            else if (trigger === 'over') {
                element.on('mouseenter' + namespace, selector, me, onEnter);
                element.on('mouseleave' + namespace, selector, me, onLeave);
            }

            if ($.type(index) === 'number') {
                me.to(index);
            }
        },

        /**
         * 激活 tab
         *
         * @param {number} index
         */
        to: function (index) {

            var me = this;

            var fromIndex = me.index;

            var targets = me.element.find(me.selector);
            var activeClass = me.activeClass;

            if (activeClass) {
                targets.eq(fromIndex).removeClass(activeClass);
                targets.eq(index).addClass(activeClass);
            }

            var data = {
                fromIndex: fromIndex,
                toIndex: index
            };

            me.index = index;

            if ($.isFunction(me.change)) {
                me.change(data);
            }
        },

        /**
         * 销毁对象
         */
        dispose: function () {

            var me = this;

            lifeCycle.dispose(me);

            me.element.off(namespace);
            me.element = null;
        }
    };

    /**
     * 默认配置
     *
     * @type {Object}
     */
    Switchable.defaultOptions = {
        index: 0,
        trigger: 'click'
    };

    /**
     * jquery 事件命名空间
     *
     * @inner
     * @type {string}
     */
    var namespace = '.cobble_helper_switchable';

    /**
     * 通过点击切换
     *
     * @inner
     * @param {Event} e
     */
    function onClick(e) {

        var switchable = e.data;
        var index = switchable.element
                       .find(switchable.selector)
                       .index(e.currentTarget);

        if (index !== switchable.index) {
            switchable.to(index);
        }
    }

    /**
     * 鼠标进入设置一个延时触发，否则会太过灵敏
     *
     * @inner
     * @param {Event} e
     */
    function onEnter(e) {

        var switchable = e.data;

        switchable.timer =
        setTimeout(
            function () {
                if (switchable.element) {

                    var index = switchable.element
                                   .find(switchable.selector)
                                   .index(e.currentTarget);

                    if (index !== switchable.index) {
                        switchable.to(index);
                    }

                }
            },
            50
        );
    }

    /**
     * 鼠标移出时删除延时
     *
     * @inner
     * @param {Event} e
     */
    function onLeave(e) {
        var switchable = e.data;
        if (switchable.timer) {
            clearTimeout(switchable.timer);
            switchable.timer = null;
        }
    }


    return Switchable;

});