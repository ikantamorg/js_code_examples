"use strict"

define([
    // Application
    'app',

    // Modules
    'modules/session',
    'modules/local',
    'modules/cache',
    'modules/route',
    'modules/custom',

    'moment'
],

function(app, Session, Local, Cache, Route, Custom) {

    var Core = app.module({
        Models: {},
        Collections: {}
    });

    Core.Views.View = Backbone.View.extend({
        // view will be appended to <div id="main"></div<
        el: '#main',
        // listening for change event of all elements with class .selfchange
        events: {
            'change .selfchange': 'changed',
            'click label.field-error': 'hideFieldError'
        },
        // contains keys for ui elements, that will be reinitialized after render in afterRender method
        ui: [],
        scroll: true,
        initialize: function() {
            // replace .selfchange event, class
            if (this.changeClassName !== undefined) {
                this.events['change .' + this.changeClassName] = 'changed';
            }
            _.bindAll(this, 'changed');
            this.events = _.extend({},Core.Views.View.prototype.events,this.events);
            this.listenToModel();
            this.listenTo(app, {
                'router-load': this.session
            });
            this.initializeHook();
        },
        initializeHook: function() {},
        listenToModel: function() {
            if (this.model) {
                this.listenTo(this.model, {
                    'request' : this.request,
                    'sync' : this.done,
                    'error' : this.error
                });
            }
        },
        session: function(viewParams) {
            if ( ! Session.exists(viewParams.alias)) {
                app.router.go('');
                return false;
            }
        },
        changed: function(ev) {
            var $el = $(ev.currentTarget),
                key = $el.data('model'),
                value = $el.val(),
                setted = {},
                isCheckbox = $el.get(0).type === 'checkbox',
                isRadio = $el.get(0).type === 'radio',
                isValueRadio = (isRadio && $el.data('radio') && $el.data('radio') === 'value');
            if (isCheckbox) {
                /*
                if (key.indexOf('[]') !== -1) {
                    key = key.replace('[]', '');
                    var clean = key.replace('[]', ''),
                        checked = !! $el.attr('checked'),
                        list = this.model.get(key);

                    if (list === undefined || ! list.length) {
                        if (value) {
                            value = [value];    
                        }
                    } else {
                        setted[key] = this.model.get(key);
                        var index = setted[key].indexOf(value);
                        if (checked) {
                            if (index === -1) {
                                setted[key].push(value);
                            }
                        } else {
                            if (index !== -1) {
                                setted[key].splice(index, 1);
                            }
                        }
                        value = setted[key];
                    }
                } else {*/
                    value = !! $el.attr('checked');
                // }
            } else if(isRadio && ! isValueRadio) {
                value = (parseInt($el.val(), 10) === 1);
            }
            setted[key] = value;
            if (this.model) {
                this.model.set(setted);
                this.trigger('core-selfchange', ev);
            } else {
                console.error('[core.js] View\'s selfchange event can\'t find model');
            }
        },
        hideFieldError: function(ev) {
            $(ev.currentTarget).hide();
        },
        serialize: function() {
            return {
                m: this.model,
                c: this.collection,
                s: Session,
                l: Local,
                r: Route
            };
        },
        serializeWithCart: function(Cart) {
            return _.extend(
                Core.Views.View.prototype.serialize(),
                { 
                    m: this.model,
                    c: this.collection,
                    cart: Cart
                }
            );
        },
        request: function(model, xhr, options) {

            // defined in "session" module, sync overwrite
            var method = options && options.lastSyncMethod;

            console.log(' >>> Request', '[', method, ']');

            this.trigger('core-request');
            this.requestHook(model, xhr, options);
        },
        requestHook: function(model, xhr, options) {

        },
        done: function(model, resp, options) {

            // defined in "session" module, sync overwrite
            var method = options.lastSyncMethod;

            console.log(' <<< Done', '[', method, ']');
            this.trigger('core-done', resp);

            // deprecateed
            var afterSave = method === 'create';

            if (method === 'read' && this.doneFetchHook) {
                this.doneFetchHook(model, resp, options, afterSave);
            } else if(method === 'create' && this.doneSaveHook) {
                this.doneSaveHook(model, resp, options, afterSave);
            } else if(method === 'delete' && this.doneDestroyHook) {
                this.doneDestroyHook(model, resp, options);
            } else {
                this.doneHook(model, resp, options, afterSave);
            }
        },
        doneHook: function() {
            this.render();
        },
        // doneFetchHook: function() {},
        // doneSaveHook: function() {},
        // doneDestroyHook: function() {},
        error: function(model, xhr, options) {

            // defined in "session" module, sync overwrite
            var method = options.lastSyncMethod;

            console.log(' O_o Error', '[', method, ']');
            try {
                var parsed = JSON.parse(xhr.responseText);

                if (parsed.code !== undefined && parsed.code === 'TOKEN_ERROR') {
                    Cache.create('lastError', {
                        code: xhr.status,
                        text: parsed.message,
                        status: parsed.statusText
                    });
                    app.router.go(Route.uri('error/auth', false, false));
                    return false;
                }

            } catch(e) {                
                Cache.create('lastError', {
                    code: xhr.status,
                    text: xhr.responseText,
                    status: xhr.statusText
                });
                app.router.go(Route.uri('error/unexpected', false, false));
                return false;
            }

            this.trigger('core-error', parsed);

            if (method === 'read' && this.errorFetchHook) {
                this.errorFetchHook(model, xhr, options, parsed);
            } else {
                this.errorHook(model, xhr, options, parsed);   
            }
        },
        // errorFetchHook: function() {},
        errorHook: function(model, xhr, options, parsed) {

        },
        beforeRender: function() {
            this.beforeRenderHook();
        },
        beforeRenderHook: function() {

        },
        afterRender: function() {
            if (_.contains(this.ui, 'popup')) {
                this.$('[data-role="popup"]').popup();
            }
            if (_.contains(this.ui, 'select')) {
                this.$('select').selectmenu();
            }
            if (_.contains(this.ui, 'radio')) {
                Custom.Ns.customizeRadiobuttons();
            }
            if (_.contains(this.ui, 'checkbox')) {
                Custom.Ns.customizeCheckboxes();
            }
            if (_.contains(this.ui, 'datepicker')) {
                Custom.Ns.setDatepicker();
            }
            if ( _.contains(this.ui, 'carousel')) {
                Custom.Ns.refreshCarousel();
                this.$('.carousel').draggableslider();
            }
            if ( _.contains(this.ui, 'tooltip')) {
                Custom.Ns.setTooltips();
            }
            if ( _.contains(this.ui, 'listview')) {
                this.$('[data-role="listview"]').listview();
            }
            if ( _.contains(this.ui, 'multiselect')) {
                Custom.Ns.customizeMultiselect();
            }

            $('div[data-role="page"]').attr('style', 
                'padding-top: 46px; padding-bottom: 0px; min-height: auto;');
            $('div[data-role="page"]').height($(document).height());

            if (this.scroll) {
                window.scrollTo(0,0);
            }

            this.trigger('core-afterRender');
            this.afterRenderHook();
        },
        afterRenderHook: function() {

        },
        show: function(params) {

            if (navigator.connection !== undefined) {
                var networkState = navigator.connection.type;
                if (networkState === Connection.NONE) {
                    app.router.go(Route.uri('error/internet', false ,false));
                }
            }

            Route.params.set(params);
            Cache.destroy();

            this.trigger('core-show');
            this.showHook(params);
        },
        showHook: function(params) {

        }
    });

    Core.Collections.Parse = function(response, ref) {
        if (response.data) {
            if (response.additional) {
                Local.set('additional', response.additional);
            }
            return _.map(response.data, function(dt) {
                return new ref.model(dt);
            });    
        } else {
            return response;
        }
    };

    Core.Collections.Collection = Backbone.Collection.extend({
        parse: function(response) {
            return Core.Collections.Parse(response, this);
        },
        addFirst: function() {
            if (this.models.length === 0) {
                this.addEmpty();
            }
        },
        addEmpty: function() {
            this.add(new this.model);
        },
        removeBy: function(cid) {
            this.remove(this.get(cid));
        },
        serialize: function() {
            return _.chain(this.models)
                .map(function(model) {
                    var serialized = model.serialize();
                    // TODO
                    if (_.size(serialized)) {
                        return serialized;
                    }   
                })
                .filter(function(model) {
                    return (model !== undefined);
                })
                .value();
        }
    });

    Core.Models.Parse = function(response, ref) {
        if (response.data) {
            if (response.additional) {
                Local.set('additional', response.additional);
            }
            return response.data;  
        } else {
            return response;
        }
    };

    Core.Models.Model = Backbone.Model.extend({
        parse: function(response) {
            return Core.Models.Parse(response, this);
        },
        reset: function(resetOnlyId) {
            if (resetOnlyId !== undefined && resetOnlyId) {
                this.id = null;
                this.unset('id');
            } else {
                this.clear().set(this.defaults);    
            }
            return this;
        },
        serialize: function() {
            return this.toJSON();
        },
        listenByView: function() {
            return new Core.Views.View({
                model: this
            });
        }
    });


    Core.Models.Popup = Core.Models.Model.extend({
        initialize: function() {
            this.id = this.attributes.id;
        }
    });

    Core.Views.Popup = Core.Views.View.extend({
        el: '.page-popup',
        events: {
            'click a:not(.nonredirect)': 'select'
        },
        scroll: false,
        initializeHook: function() {
            if (this.id !== undefined) {
                this.model = new Core.Models.Popup({
                    id: this.id
                });
                this.listenToModel();
            }
            // extend popup events with custom provided events
            this.events = _.extend({},Core.Views.Popup.prototype.events,this.events);
            this.render();
        },
        itemId: function(ev) {
            var $el = $(ev.currentTarget),
                itemId = $el.closest('ul').data('item');
            return itemId;
        },
        // open depending on taphold position
        open: function() {
            var height = this.$el.height(),
                offsetHeight = height / 2,
                offsetWidth = -14;
            this.$el.show();
            this.$el.popup('open', {
                transition: 'flip',
                overlay: 0,
                x: this.Ui.Hold.x + offsetWidth,
                y: this.Ui.Hold.y + offsetHeight
            });
        },
        // when user select's any item in popup - close it
        select: function(ev) {
            this.$el.popup('close');
        },
        // rewrite to prevent render after sync
        // has render function by default in core
        doneHook: function() {},
        afterRenderHook: function() {
            // popup should be opened when rendered
            this.open();
            // detach all events when closed
            var popupAfterClose = _.bind(function() {
                this.undelegateEvents();
                // this.remove();
            }, this);
            this.$el.bind({ popupafterclose: popupAfterClose });
        }
    });

    // template for all reports
    Core.Views.ReportFilter = Core.Views.View.extend({
        el: null,
        initializeHook: function() {
            this.stopListening();
        }
    });

    Core.Models.ReportTemplate = Core.Models.Model.extend({
        defaults: {
            from: moment().format('DD/MM/YYYY'),
            to: moment().format('DD/MM/YYYY'),
            extra_from: moment().format('DD/MM/YYYY'),
            extra_to: moment().format('DD/MM/YYYY')
        },
        serialize: function() {
            var clean = _.omit(this.toJSON(), 'items', 'sub_items', 'title', 'data', 'template_options');
            if ( ! this.get('template_options').extraDates) {
                clean = _.omit(clean, 'extra_to', 'extra_from');
            }
            return clean;
        }
    });

    Core.Views.ReportTemplate = Core.Views.View.extend({
        template: 'common/report/template',
        ui: ['select', 'datepicker'],
        events: {
            'change .page-range': 'range',
            'change .page-from,.page-to': 'date',
            'change .page-expand-subfilter': 'subfilter',
            'click .action-toggle-filter': 'toggleFilter'
        },
        templateOptions: {},
        $range: null, $from: null, $to: null, $result: null, $filter: null,
        today: null, month: null, year: null,
        filterHidden: false,
        initializeHook: function() {
            var format = 'DD/MM/YYYY';

            this.model = new Core.Models.ReportTemplate;
            this.listenToModel();

            this.today = moment().startOf('day').format(format);
            this.month = moment().startOf('month').format(format);
            this.year = moment().startOf('year').format(format);

            this.resetOptions();
        },
        resetOptions: function() {
            this.filterHidden = false;
            this.templateOptions = _.extend({
                fetchUrl: null,
                resultUrl: null,
                // emailUrl: null,
                pageTitle: null,
                useFilter: true,
                extraDates: false,
                extraDatesPrefix: '',
                filterTemplate: 'common/report/filter',
                filterTitle: '',
                filterUseDate: false,
                subFiltersTitles: [],
                fields: ['Date', 'Total Amount']
            }, this.templateOptions);
            this.model.set('template_options', this.templateOptions);
        },
        action: function() {
            this.model.urlRoot = Route.url('report/' + this.templateOptions.resultUrl);
            this.model.fetch({
                data: this.model.serialize()
            });
        },
        range: function() {
            var range = this.model.get('range');
            if (range) {
                this.$to.val(this.today);
                if (range === 'year') {
                    this.$from.val(this.year);
                } else if (range === 'month') {
                    this.$from.val(this.month);
                } else {
                    this.$from.val(this.today);   
                } 
                this.$to.trigger('change', { silent: true });
                this.$from.trigger('change', { silent: true });
            }
        },
        date: function(ev, options) {
            if (options === undefined || options.silent !== true) {
                this.$range.val([]).trigger('change');
            }
        },
        subfilter: function() {
            var itemId = parseInt(this.model.get('item_id'), 10),
                item = _.findWhere(this.model.get('items'), { id : itemId }),
                subItems = {};
            if (item) {
                subItems = item.items;
            }
            this.model.set('sub_items', subItems);
            this.model.unset('sub_item_id');
            this.render();
        },
        toggleFilter: function(ev) {
            var $el = $(ev.currentTarget);
            this.filterHidden = ! this.$filter.is(':hidden');
            if (this.filterHidden) {
                $el.html('&darr; Show filter');
            } else {
                $el.html('&uarr; Hide filter');
            }
            this.$filter.slideToggle(this.filterHidden);
        },
        requestHook: function() {
            if (this.$result) {
                this.$result.empty().addClass('page-loading');
            }
        },
        doneFetchHook: function() {
            if (this.$result && this.model.get('data')) {
                this.$result.removeClass('page-loading');
                this.filterHidden = true;
            }
            this.render();
        },
        email: function() {
            console.log('email', this.templateOptions.emailUrl);
        },
        beforeRenderHook: function() {
            if (this.templateOptions.filterTemplate) {
                var filter = new Core.Views.ReportFilter({
                    template: this.templateOptions.filterTemplate,
                    model: this.model
                });
                this.setView('.page-filter', filter);
            }
            this.model.set('filterHidden', this.filterHidden);
        },
        afterRenderHook: function() {
            this.$range = this.$('.page-range');
            this.$from = this.$('.page-from');
            this.$to = this.$('.page-to');
            this.$result = this.$('.page-result');
            this.$filter = this.$('.page-filter-toggle');
        },
        showHook: function(params) {
            this.Ui.Header.set({ 
                title: 'Report - ' + this.templateOptions.pageTitle,
                action: 'Update',
                fn: this.action
            }, this);
            /*
            this.Ui.Footer.set([
                { title: 'E-mail report', icon: 'email', fn: this.email }
            ], this);*/
            this.model.reset();
            this.resetOptions();
            if (this.templateOptions.fetchUrl) {
                this.model.urlRoot = Route.url('report/' + this.templateOptions.fetchUrl);
                this.model.fetch();
            } else {
                this.render();
            }
        }
    });

    return Core;
});