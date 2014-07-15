/**
 * @file Input
 * @author zhujl
 */
define(function (require, exports, module) {

    /**
     * 1. 兼容 input 事件
     *
     * IE9+ 和 其他标准浏览器都支持 input 事件
     * IE9- 支持 propertychange 事件，需判断 event.propertyName 是否为 'value'
     *
     * input 标准触发方式包括：输入、backspace、delete、剪切、粘贴、拖拽
     *
     * IE9 不支持 backspace、delete、剪切、拖拽 触发，不论 input 或 propertychange 事件（未解决，使用定时器太恶心了）
     * addEventListener 绑定的 propertychange 事件永远不会触发，所以用 jq 的话 IE9 必须绑定 input 事件
     *
     * IE8-的 propertychange 事件触发方式和 input 标准方式相同
     * IE8-改写 value 会触发 propertychange
     *
     * 为了避免和原生 input 事件重名，而初学者又较容易理解 change 事件
     * 因此统一向外广播 change 事件
     *
     * 2. 长按是否触发 change 事件
     *
     * 长按大多产生一串相同的字符串，这种属于无效输入
     *
     * 3. chrome 下 <input type="text" /> 按方向键上会使光标跑到最左侧
     *
     */

    'use strict';

    var call = require('../function/call');
    var around = require('../function/around');

    var Keyboard = require('./Keyboard');

    /**
     * 封装一些输入功能，包括兼容最常用的 input 事件
     *
     * @constructor
     * @param {Object} options
     * @property {jQuery} options.element 输入框元素
     *
     * @property {boolean=} options.smart 是否能够聪明的在长按时不触发 change 事件，默认为 true
     *                                    因为长按产生的一般是无效输入
     *
     * @property {boolean=} options.longPress 配置的 action 事件是否支持长按连续触发，默认为 false
     *
     * @property {Function=} options.onKeyDown 按下键位触发
     * @argument {Event} options.onLongPressStart.event
     *
     * @property {Function=} options.onKeyUp 松开键位触发
     * @argument {Event} options.onLongPressStart.event
     *
     * @property {Function=} options.onChange 内容变化触发
     *
     * @property {Function=} options.onLongPressStart 长按开始
     * @argument {Event} options.onLongPressStart.event
     *
     * @property {Function=} options.onLongPressEnd 长按结束
     *                                              如果返回 false，可不触发 change 事件
     *                                              如果返回不是 false，值变化了才会触发 change 事件
     * @argument {Event} options.onLongPressStart.event
     *
     * @property {Object=} options.action 按下某键，发出某事件
     *                                    组合键只支持 shift/ctrl/alt/meta + 字母/数字
     *                                    举个例子：
     *                                    {
     *                                        'enter': function () {
     *                                            // submit
     *                                        },
     *                                        'up': function () {
     *                                            // up
     *                                        },
     *                                        'ctrl+c': function () {
     *                                            // copy
     *                                        },
     *                                        'ctrl+alt+a': function () {
     *                                            // 截图
     *                                        }
     *                                    }
     *
     * @property {*} options.scope 为以上函数设置 this 对象
     *
     */
    function Input(options) {
        $.extend(this, Input.defaultOptions, options);
        this.init();
    }

    Input.prototype = {

        constructor: Input,

        /**
         * 初始化
         */
        init: function () {

            var me = this;

            var scope = me.scope;
            if (!scope) {
                scope = me.scope = me;
            }

            var bindEvent = support === 'input'
                          ? bindInput
                          : bindPropertyChange;

            bindEvent(me);

            var element = me.element;
            var cache = me.cache = { };

            var onKeyDown = me.onKeyDown;
            if (element.prop('tagName') === 'INPUT') {
                onKeyDown = function (e) {
                    if (e.keyCode === Keyboard.map.up) {
                        e.preventDefault();
                    }
                    call(me.onKeyDown, scope, e);
                };
            }

            var value;

            cache.keyboard = new Keyboard({
                element: element,
                action: me.action,
                longPress: me.longPress,
                onKeyDown: onKeyDown,
                onKeyUp: me.onKeyUp,
                onLongPressStart: function (e) {
                    cache.longPressing = true;
                    call(me.onLongPressStart, scope, e);

                    value = element.val();
                },
                onLongPressEnd: function (e) {
                    cache.longPressing = false;
                    if (call(me.onLongPressEnd, scope, e) !== false
                        && value !== element.val()
                    ) {
                        triggerChange(me);
                    }
                },
                scope: scope
            });

        },

        /**
         * 自动变高
         */
        autoHeight: function () {

            var me = this;
            var element = me.element;

            // 自动变高必须设置 overflow-y: hidden
            if (element.css('overflow-y') !== 'hidden') {
                element.css('overflow-y', 'hidden');
            }

            var originHeight = element.height();

            var oldHeight = originHeight;
            var newHeight;

            var lineHeight = parseInt(element.css('font-size'), 10);
            var padding = element.innerHeight() - originHeight;

            me.cache.onChange = function () {

                // 把高度重置为原始值才能取到正确的 newHeight
                if (oldHeight !== originHeight) {
                    oldHeight = originHeight;
                    element.height(originHeight);
                }

                // scrollHeight 包含上下 padding 和 height
                newHeight = element.prop('scrollHeight') - padding;

                if (Math.abs(newHeight - oldHeight) > lineHeight) {
                    element.height(newHeight);
                    oldHeight = newHeight;
                }
            };
        },

        /**
         * 销毁对象
         */
        dispose: function () {

            var me = this;

            me.element.off(namespace);

            me.cache.keyboard.dispose();

            me.action =
            me.cache =
            me.element = null;
        }
    };

    /**
     * 默认配置
     *
     * @static
     * @type {Object}
     */
    Input.defaultOptions = {
        smart: true,
        longPress: false
    };

    /**
     * jquery 事件命名空间
     *
     * @inner
     * @type {string}
     */
    var namespace = '.cobble_helper_input';

    var input = $('<input type="text" />')[0];

    /**
     * 特性检测支持的 input 事件名称
     *
     * @inner
     * @type {string}
     */
    var support = 'oninput' in input
                ? 'input'
                : 'propertychange';

    input = null;

    /**
     * 初始化标准浏览器的 input 事件监听
     *
     * @inner
     * @param {Input} input
     */
    function bindInput(input) {
        input.element.on(
            support + namespace,
            function () {
                triggerChange(input);
            }
        );
    }

    /**
     * 初始化 IE8- 的 propertychange 事件监听
     *
     * @inner
     * @param {Input} input
     */
    function bindPropertyChange(input) {

        var element = input.element;

        // propertychange 事件在 IE67 下可能出现死循环，原因不明
        // 简单的判断 propertyName 是否为 value 不够
        // 必须跟上次的值比较一下
        var oldValue = element.val();

        // element.val('xxx') 在 IE 下会触发 propertychange
        // 这和标准浏览器的行为不一致
        // 这个并不能完美解决问题
        // 比如使用 element[0].value = 'xx' 无法检测到
        var changeByVal = false;

        element.on(
            support + namespace,
            function (e) {
                if (changeByVal) {
                    changeByVal = false;
                    return;
                }
                if (e.originalEvent.propertyName === 'value') {
                    var newValue = element.val();
                    if (newValue !== oldValue) {
                        triggerChange(input);
                        oldValue = newValue;
                    }
                }
            }
        );

        around(
            element,
            'val',
            function () {
                if (arguments.length === 0) {
                    changeByVal = true;
                }
            }
        );
    }

    /**
     * 触发 change 事件
     *
     * @inner
     * @param {Input} input
     */
    function triggerChange(input) {

        var cache = input.cache;

        if (!input.smart
            || !cache.longPressing
        ) {
            call(input.onChange, input.scope);
        }

        // 在最后执行内部的 onChange，以防上面的 onChange 改值了
        call(cache.onChange, cache);
    }


    return Input;

});
