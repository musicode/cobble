/**
 * @file 组件生命周期管理
 * @author musicode
 */
define(function (require, exports, module) {

    'use strict';

    var guid = require('../function/guid');
    var around = require('../function/around');
    var extend = require('../function/extend');
    var ucFirst = require('../function/ucFirst');
    var createTimer = require('./timer');

    /**
     * 为了更好的性能，以及彻底解决初始化触发 change 事件带来的同步问题
     * 新版把 change 事件做成了单独时间片触发
     *
     */

    var instances = { };

    /**
     * 批量更新的 timer
     *
     * 只要是一次新的时间片就行，不要间隔过长，否则页面看起来是一卡一卡的
     *
     * @inner
     */
    var updateTimer = createTimer(
        function () {
            $.each(instances, function (id, instance) {

                if (!instance.$) {
                    return;
                }

                var createUpdater = function (updater, changes) {
                    return function (name, change) {
                        var fn = updater[ name ];
                        if ($.isFunction(fn)) {
                            return fn.call(
                                instance,
                                change.newValue,
                                change.oldValue,
                                changes
                            );
                        }
                    };
                };

                var staticUpdater;
                var instanceUpdater;

                var propertyChanges = instance.inner('propertyChanges');
                if (propertyChanges) {

                    staticUpdater = instance.constructor.propertyUpdater;
                    if (staticUpdater) {
                        $.each(
                            propertyChanges,
                            createUpdater(staticUpdater, propertyChanges)
                        );
                    }

                    instanceUpdater = instance.option('propertyChange');
                    if (instanceUpdater) {
                        $.each(
                            propertyChanges,
                            createUpdater(instanceUpdater, propertyChanges)
                        );
                    }

                    instance.emit('propertychange', propertyChanges);
                    instance.inner('propertyChanges', null);

                }

                var stateChanges = instance.inner('stateChanges');
                if (stateChanges) {

                    staticUpdater = instance.constructor.stateUpdater;
                    if (staticUpdater) {
                        $.each(
                            stateChanges,
                            createUpdater(staticUpdater, stateChanges)
                        );
                    }

                    instanceUpdater = instance.option('stateChange');
                    if (instanceUpdater) {
                        $.each(
                            stateChanges,
                            createUpdater(instanceUpdater, stateChanges)
                        );
                    }

                    instance.emit('statechange', stateChanges);
                    instance.inner('stateChanges', null);

                }

            });
        },
        0
    );

    updateTimer.start();

    /**
     * 创建 jQuery Event 对象
     *
     * @inner
     * @param {string|Object|Event} event
     * @return {Event}
     */
    function createEvent(event) {

        if (event && !event[ $.expando ]) {
            event = $.type(event) === 'string' || event.type
                  ? $.Event(event)
                  : $.Event(null, event);
        }

        return event || $.Event();

    }

    /**
     * setter 构造器
     *
     * @inner
     * @param {string} singular 单数形式
     * @param {string} complex 复数形式
     * @param {string} setter setter 方法
     * @param {string} getter getter 方法
     */
    function createSettter(singular, complex, setter, getter, validate) {

        return function (name, value, options) {

            var me = this;

            if ($.isPlainObject(name)) {

                options = value;

                $.each(
                    name,
                    function (name, value) {
                        me[ setter ](name, value, options);
                    }
                );

                return;

            }

            options = options || { };

            var validator = me.constructor[ singular + 'Validator' ];
            if (validator) {
                if ($.isFunction(validator[ name ])) {
                    value = validator[ name ].call(me, value);
                }
            }

            if (validate) {
                value = validate(me, name, value);
            }

            var oldValue = me[ getter ](name);
            if (oldValue === value && !options.force) {
                return;
            }

            me[ complex ][ name ] = value;

            if (options.silent) {
                return;
            }

            // 批量更新
            var record = { };
            extend(record, options);

            record.newValue = me[ getter ](name);
            record.oldValue = oldValue;

            var changes = me.inner(singular + 'Changes');
            if (!changes) {
                changes = { };
                me.inner(singular + 'Changes', changes);
            }

            var oldRecord = changes[ name ];
            if (oldRecord) {
                if (oldRecord.oldValue === record.newValue) {
                    delete changes[ name ];
                    return;
                }
            }

            changes[ name ] = record;

        };

    }

    var methods = {

        /**
         * 绑定事件
         */
        on: function (event, data, handler) {
            this.$.on(event, data, handler);
            return this;
        },

        /**
         * 解绑事件
         */
        off: function (event, handler) {
            this.$.off(event, handler);
            return this;
        },

        /**
         * 触发事件
         *
         * @param {Event|string} event 事件对象或事件名称
         * @param {Object=} data 事件数据
         * @return {Event}
         */
        emit: function (event, data) {

            var me = this;
            var context = me.option('context') || me;

            event = createEvent(event);

            event.origin = context;

            // 经由 apply(me) 之后，currentTarget 会变成 me.$
            // 因此需要新增一个属性来存储最初的元素

            var currentTarget = event.currentTarget;
            if (currentTarget && currentTarget.tagName) {
                event.originElement = currentTarget;
            }


            var args = [ event ];
            if ($.isPlainObject(data)) {
                args.push(data);
            }

            event.type = event.type.toLowerCase();

            context.$.trigger.apply(context.$, args);

            if (event.isPropagationStopped()) {
                return event;
            }

            if (context.execute('on' + event.type, args) === false) {
                event.preventDefault();
                event.stopPropagation();
            }

            return event;

        },

        /**
         * 监听 before 事件，比如 before('init', function () { });
         *
         * @param {string} event
         * @param {Function} handler
         * @return {Object}
         */
        before: function (event, handler) {
            return this.on(
                'before' + event.toLowerCase(),
                handler
            );
        },

        /**
         * 监听 after 事件，比如 after('init', function () { });
         *
         * @param {string} event
         * @param {Function} handler
         * @return {Object}
         */
        after: function (event, handler) {
            return this.on(
                'after' + event.toLowerCase(),
                handler
            );
        },

        /**
         * 把组件元素加到 target 内部结束位置
         */
        appendTo: function (target) {
            var element = this.inner('main');
            if (element) {
                element.appendTo(target);
            }
        },

        /**
         * 把组件元素加到 target 内部开始位置
         */
        prependTo: function (target) {
            var element = this.inner('main');
            if (element) {
                element.prependTo(target);
            }
        },

        execute: function (name, args) {

            var me = this;
            var fn = name;

            if ($.type(name) === 'string') {
                fn = me[ name ] || me.option(name);
            }

            if ($.isFunction(fn)) {

                var context = me.option('context') || me;

                if ($.isArray(args)) {
                    return fn.apply(context, args);
                }
                else {
                    return fn.call(context, args);
                }

            }

        },

        namespace: function () {
            return '.' + this.guid;
        },

        option: function (name) {
            return this.options[ name ];
        },

        inner: function (name, value) {

            var me = this;

            if (arguments.length === 1 && $.type(name) === 'string') {
                return me.inners[ name ];
            }
            else {

                if ($.isPlainObject(name)) {
                    $.each(name, function (name, value) {
                        me.inner(name, value);
                    });
                    return;
                }

                me.inners[ name ] = value;

            }

        },

        /**
         * state getter
         *
         * @param {string} name
         * @return {boolean}
         */
        is: function (name) {
            return this.states[ name ];
        },

        /**
         * state setter
         */
        state: createSettter('state', 'states', 'state', 'is',
            function (instance, name, value) {
                if ($.type(value) !== 'boolean') {
                    value = false;
                }
                return value;
            }
        ),

        /**
         * property getter
         */
        get: function (name) {
            return this.properties[ name ];
        },

        /**
         * property setter
         */
        set: createSettter('property', 'properties', 'set', 'get')

    };

    /**
     * 扩展原型
     *
     * @param {Object} proto
     */
    exports.extend = function (proto) {

        //
        // 为了实现统一拦截，必须规定一些用法：

        // 方法如果有前置校验，比如判断参数不合法直接返回，应该不用触发 before 事件
        // 我们规定，方法的前置校验方法叫做 _method，后置方法叫做 method_
        // 比如 open 方法的前置校验方法叫做 _open，后置方法叫做 open_
        //
        // 前置方法除了做校验，还可以返回一个事件数据，便于通知外部
        // 返回 false 表示阻止执行，返回 Object 会作为事件数据发出去

        $.each(
            proto,
            function (name) {

                var _index = name.indexOf('_');
                if (_index === 0 || _index === name.length - 1) {
                    return;
                }

                around(
                    proto,
                    name,
                    function (event) {

                        var me = this;

                        var eventData;

                        var preMethod = proto[ '_' + name ];
                        if ($.isFunction(preMethod)) {
                            eventData = preMethod.apply(me, arguments);
                            if (eventData === false) {
                                return false;
                            }
                        }

                        event = createEvent(event);
                        event.type = 'before' + name;

                        event = this.emit(event, eventData);

                        // 阻止默认行为也就不在执行后续的方法
                        if (event.isDefaultPrevented()) {
                            return false;
                        }

                    },
                    function (event) {

                        var me = this;
                        var args = arguments;

                        var emitAfterEvent = function () {

                            var eventData;

                            var postMethod = proto[ name + '_' ];
                            if ($.isFunction(postMethod)) {
                                eventData = postMethod.apply(me, args);
                                if (eventData === false) {
                                    return;
                                }
                            }

                            event = createEvent(event);
                            event.type = 'after' + name;

                            me.emit(event, eventData);

                        };

                        var executeResult = args[ args.length - 1 ];

                        if (executeResult && executeResult.then) {
                            executeResult.then(emitAfterEvent);
                        }
                        else {
                            emitAfterEvent();
                        }

                    }
                );


            }
        );

        extend(proto, methods);

    };

    /**
     * 初始化组件
     *
     * @param {*} instance 组件实例对象
     * @param {Object} options 初始化组件所用的配置
     * @return {*} 组件实例
     */
    exports.init = function (instance, options) {

        // options 不要污染 instance，避免 API 的设计自由因 options 字段名受到影响

        var defaultOptions = instance.constructor.defaultOptions;

        if ($.isPlainObject(defaultOptions)) {
            extend(options, defaultOptions);
        }

        instances[ instance.guid = guid() ] = instance;

        // 用 properties 属性管理属性
        instance.properties = { };

        // 用 options 属性管理用户配置
        instance.options = options;

        // 用 options 属性管理状态
        instance.states = { };

        // 用 inners 属性管理内部属性
        instance.inners = { };

        // 用 jQuery 实现事件系统
        instance.$ = $({ });

        instance.init();

        instance.after('dispose', function () {

            // 因为调用 dispose 需要发事件
            // 用延时确保在最后执行才不会报错
            setTimeout(function () {

                instance.properties =
                instance.options =
                instance.changes =
                instance.states =
                instance.inners =
                instance.guid =
                instance.$ = null;

            });

        });
console.log(instance)
        return instance;

    };

    /**
     * 销毁组件
     *
     * @param {*} instance 组件实例
     */
    exports.dispose = function (instance) {

        delete instances[ instance.guid ];

        instance.$.off();

    };

});