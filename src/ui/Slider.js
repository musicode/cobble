/**
 * @file 可滑动组件
 * @author zhujl
 */
define(function (require, exports, module) {

    'use strict';

    var contains = require('../function/contains');
    var position = require('../function/position');
    var eventOffset = require('../function/eventOffset');
    var Draggable = require('../helper/Draggable');
    var Wheel = require('../helper/Wheel');

    /**
     * 可滑动组件，类似 html5 的 <input type="number" />
     *
     * @constructor
     * @param {Object} options
     * @property {jQuery} options.element
     * @property {number=} options.value
     * @property {number=} options.min 允许的最小值
     * @property {number=} options.max 允许的最大值
     * @property {number=} options.step value 变化的最小间隔，默认是 10
     * @property {boolean=} options.scrollable 是否可以滚动触发，如果设为 true，需要设置 step
     * @property {string=} options.direction 方向，可选值有 horizontal 和 vertical，默认是 horizontal
     * @property {string=} options.template 模板，如果 element 结构已完整，可不传模板
     *
     * @property {Object=} options.selector 选择器
     * @property {string=} options.selector.thumb 滑块选择器
     * @property {string=} options.selector.track 滑道选择器，不传表示 element 是滑道
     *
     * @property {Object=} options.className 样式
     * @property {string=} options.className.dragging 滑块正在拖拽时的 class
     * @property {string=} options.className.hover 鼠标悬浮滑道时的 class
     *
     * @property {Object=} options.animation 动画
     * @property {Function=} options.animation.to 通过点击直接滑到某个位置的动画
     * @property {Function=} options.animation.dragging 通过拖拽滑块到某个位置的动画
     * @property {Function=} options.animation.show 显示动画
     * @property {Function=} options.animation.hide 隐藏动画
     *
     * @property {Function=} options.onChange 当 value 变化时触发
     * @property {Function=} options.onBeforeDrag
     * @property {Function=} options.onAfterDrag
     */
    function Slider(options) {
        $.extend(this, Slider.defaultOptions, options);
        this.init();
    }

    Slider.prototype = {

        constructor: Slider,

        /**
         * 初始化
         */
        init: function () {

            var me = this;
            var element = me.element;
            var template = me.template;

            if (template) {
                element.html(template);
            }

            var selector = me.selector;
            var thumbElement = element.find(selector.thumb);
            var trackElement = selector.track
                             ? element.find(selector.track)
                             : element;

            var cache = me.cache
                      = $.extend(
                            {
                                thumb: thumbElement,
                                track: trackElement
                            },
                            directionConf[ me.direction ]
                        );

            cache.draggable = createDraggable(
                                me,
                                {
                                    element: thumbElement,
                                    container: trackElement,
                                    silence: true,
                                    axis: cache.axis
                                }
                            );

            trackElement.on('click' + namespace, me, clickTrack);

            if (me.className.hover) {
                trackElement.on('mouseenter' + namespace, me, enterTrack)
                            .on('mouseleave' + namespace, me, leaveTrack);
            }

            if (me.scrollable) {
                cache.wheel = new Wheel({
                    element: trackElement,
                    onScroll: function (data) {
                        return !me.setValue( me.value + data.delta * me.step );
                    }
                });
            }

            me.refresh();
        },

        /**
         * 根据当前视图刷新相关计算数值
         *
         * @param {Object} data
         * @property {number=} data.value
         */
        refresh: function (data) {

            var me = this;

            if ($.isPlainObject(data)) {
                $.extend(me, data);
            }

            var max = me.max;
            var min = me.min;

            var cache = me.cache;
            var total = cache.draggable
                             .getRectange(true)[ cache.dimension ];

            cache.min = 0;
            cache.max = total;

            if ($.isNumeric(min) && $.isNumeric(max)) {
                cache.stepPixel = total / ((max - min) / me.step);
            }

            var value = me.value;
            var options = { force: true };

            if (!$.isNumeric(value)) {
                value = position(cache.thumb)[ cache.position ];
                value = parseInt(value, 10);
                options.pixel = true;
            }

            me.setValue(value, options);
        },

        /**
         * 获取当前值
         *
         * @return {number}
         */
        getValue: function () {
            return this.value;
        },

        /**
         * 设置当前值
         *
         * @param {number} value
         * @param {Object=} options 可选项
         * @property {boolean=} options.silence 是否不触发 onChange 事件，默认为 false
         * @property {boolean=} options.force 是否强制更新
         * @property {boolean=} options.pixel value 是否以像素为单位
         * @property {Object=} options.animate
         * @return {boolean} 是否更新成功
         */
        setValue: function (value, options) {

            options = options || { };

            var me = this;
            var cache = me.cache;

            var stepPixel = cache.stepPixel;
            var pixel;

            if ($.isNumeric(stepPixel)) {
                if (options.pixel) {
                    value = pixel2Value(value, me.min, me.step, stepPixel);
                }
                value = restrain(value, me.min, me.max);
                pixel = value2Pixel(value, me.min, me.step, stepPixel);
            }
            else {
                pixel = value
                      = restrain(value, cache.min, cache.max);
            }

            if (!options.force && value === me.value) {
                return false;
            }

            me.value = value;

            var element = cache.thumb;
            var style = { };
            style[ cache.position ] = pixel;

            var animate = options.animate;
            if ($.isFunction(animate)) {
                animate.call(me, style, element);
            }
            else {
                element.css(style);
            }

            if (!options.silence
                && $.isFunction(me.onChange)
            ) {
                me.onChange();
            }

            return true;
        },

        /**
         * 获取 滑道 和 滑块 的大小
         *
         * @return {Object}
         * @property {number} $return.track
         * @property {number} $return.thumb
         */
        getSize: function () {

            var cache = this.cache;

            return {
                track: cache.track[ cache.innerDimension ](),
                thumb: cache.thumb[ cache.outerDimension ]()
            };
        },

        /**
         * 设置 滑道 和 滑块 的大小
         *
         * @param {Object} data
         * @property {number=} data.track
         * @property {number=} data.thumb
         */
        setSize: function (data) {

            var cache = this.cache;
            var dimension = cache.dimension;
            var offset;

            if ($.isNumeric(data.track)) {

                var track = cache.track;

                offset = track[ cache.innerDimension ]()
                       - track[ dimension ]();

                track[ dimension ](data.track - offset);
            }

            if ($.isNumeric(data.thumb)) {

                var thumb = cache.thumb;

                offset = thumb[ cache.outerDimension ]()
                       - thumb[ dimension ]();

                thumb[ dimension ](data.thumb - offset);
            }
        },

        /**
         * 显示
         */
        show: function () {

            var me = this;
            var show = me.animation.show;

            if ($.isFunction(show)) {
                show.call(me);
            }
            else {
                me.element.show();
            }
        },

        /**
         * 隐藏
         */
        hide: function () {

            var me = this;
            var hide = me.animation.hide;

            if ($.isFunction(hide)) {
                hide.call(me);
            }
            else {
                me.element.hide();
            }
        },

        /**
         * 销毁对象
         */
        dispose: function () {

            var me = this;
            var cache = me.cache;

            cache.track.off(namespace);
            cache.draggable.dispose();

            if (cache.wheel) {
                cache.wheel.dispose();
            }

            me.element =
            me.cache = null;
        }

    };

    /**
     * 默认配置
     *
     * @static
     * @type {Object}
     */
    Slider.defaultOptions = {

        step: 10,
        scrollable: false,
        direction: 'horizontal',
        template: '<i class="slider-thumb"></i>',

        className: { },
        animation: { },
        selector: {
            thumb: '.slider-thumb'
        }
    };

    /**
     * jquery 事件命名空间
     *
     * @inner
     * @type {string}
     */
    var namespace = '.cobble_ui_slider';

    /**
     * 配置方向属性
     *
     * @inner
     * @type {Object}
     */
    var directionConf = {
        horizontal: {
            axis: 'x',
            position: 'left',
            dimension: 'width',
            innerDimension: 'innerWidth',
            outerDimension: 'outerWidth'
        },
        vertical: {
            axis: 'y',
            position: 'top',
            dimension: 'height',
            innerDimension: 'innerHeight',
            outerDimension: 'outerHeight'
        }
    };

    /**
     * value 转成 pixel
     *
     * @inner
     * @param {number} value 实际值
     * @param {number} min 实际最小值
     * @param {number} step 步进值
     * @param {number} stepPixel 步进像素值
     * @return {number}
     */
    function value2Pixel(value, min, step, stepPixel) {
        return stepPixel * (value - min) / step;
    }

    /**
     * pixel 转成 value
     *
     * @inner
     * @param {number} pixel 像素值
     * @param {number} min 实际最小值
     * @param {number} step 步进值
     * @param {number} stepPixel 步进像素值
     * @return {number}
     */
    function pixel2Value(pixel, min, step, stepPixel) {
        return min + Math.floor(pixel / stepPixel) * step;
    }

    /**
     * 约束范围
     *
     * @inner
     * @param {value} value
     * @param {number} min
     * @param {number} max
     * @return {number}
     */
    function restrain(value, min, max) {
        if (value < min) {
            value = min;
        }
        else if (value > max) {
            value = max;
        }
        return value;
    }

    /**
     * 创建可拖拽对象
     *
     * @inner
     * @param {Slider} slider
     * @param {Object} options 创建可拖拽对象的配置
     * @return {Draggable}
     */
    function createDraggable(slider, options) {

        var cache = slider.cache;
        var draggingClass = slider.className.dragging;

        options.onDragStart = function () {

            cache.dragging = true;

            if ($.type(draggingClass) === 'string') {
                options.container
                       .addClass(draggingClass);
            }

            if ($.isFunction(slider.onBeforeDrag)) {
                slider.onBeforeDrag({
                    leave: cache.leave
                });
            }
        };

        options.onDragEnd = function (point) {

            cache.dragging = false;

            if ($.type(draggingClass) === 'string') {
                options.container
                       .removeClass(draggingClass);
            }

            if ($.isFunction(slider.onAfterDrag)) {
                slider.onAfterDrag({
                    leave: cache.leave
                });
            }
        };

        options.onDrag = function (data) {
            slider.setValue(
                data[ cache.position ],
                {
                    pixel: true,
                    animate: slider.animation.dragging
                }
            );
        };

        return new Draggable(options);
    }

    /**
     * 点击滑道直接跳转到目标位置
     *
     * @inner
     * @param {Event} e
     */
    function clickTrack(e) {

        var slider = e.data;
        var cache = slider.cache;

        if (contains(cache.thumb[0], e.target)) {
            return;
        }

        slider.setValue(
            eventOffset(e)[ cache.axis ],
            {
                pixel: true,
                animate: slider.animation.to
            }
        );
    }

    /**
     * 鼠标进入滑道添加 hoverClass
     *
     * @inner
     * @param {Event} e
     */
    function enterTrack(e) {
        var slider = e.data;
        slider.cache.leave = false;
        slider.element.addClass(slider.className.hover);
    }

    /**
     * 鼠标离开滑道移除 hoverClass
     *
     * @inner
     * @param {Event} e
     */
    function leaveTrack(e) {

        var slider = e.data;
        var cache = slider.cache;
        var className = slider.className;

        cache.leave = true;

        if (!cache.dragging
            || className.hover !== className.dragging
        ) {
            slider.element.removeClass(className.hover);
        }
    }


    return Slider;

});