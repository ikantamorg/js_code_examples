(function ($, _, Backbone) {

    "use strict"

    $.ajaxSetup({ cache: false });

    var commentModel = Backbone.Model.extend({
        type:'comment',
        urlRoot: g_settings.base_url + g_settings.commentUrl,
        vote:function(direction){
            return this.save({vote:direction},{patch:true, wait:true});
        },
        parse:function(data){
            if(!_.isUndefined(data.level ) && data.level == 1 && _.isUndefined(this.commentsCollection) ){
                this.commentsCollection = new commentsCollection;
            }
            if( !_.isUndefined(data.children) && data.children.length ){
                this.commentsCollection.reset(data.children);
                delete data.children;
            }

            return data;
        }
    });

    var commentsCollection = Backbone.Collection.extend({
        model:commentModel,
        url: g_settings.base_url + g_settings.commentsUrl,
        tryLoad:true,
        lock: false,
        count:function(){
            return this.models.length;
        }
    });

    var ideaModel = Backbone.Model.extend({
        type:'idea',
        urlRoot: g_settings.base_url + g_settings.single_idea_url,
        vote:function(vote){
            return this.save({vote:vote},{patch:true, wait:true});
        },
        statusUpdate:function(new_status){
            return this.save({status:new_status},{patch:true, wait:true});
        },
        initialize:function(){
            this.commentsCollection = new commentsCollection;
        },
        follow:function(status){
            return this.save({follow:status},{patch:true, wait:true});
        },
    });
    var ideasCollection = Backbone.Collection.extend({
        model:ideaModel,
        url: g_settings.base_url + g_settings.collection_ideas_url,
        ideaFilter: 0,
        resetFilter:false
    });


    var GroupModel = Backbone.Model.extend({
        type:'group',
        tagsMaxLevel:5,
        urlRoot:g_settings.base_url + g_settings.single_group_url,
        defaults:{
            name:'',
            tags:[]
        },
        initialize:function(){
          this.ideaCollection = new ideasCollection;
        },
            parse:function (response) {

            if (_.isString(response)) {
                return;
            }
            if ( !_.isUndefined(response.group_count)) {
                this.updateGroupCount(response.group_count);
            }
            if(!_.isUndefined( response.model )){
                this.tagLevel(response.model);
                return response.model;
            }
            if(_.isObject(response) ){
                this.tagLevel(response);
                return response;
            }

        },
        updateGroupCount:function(count){
            Views.group_menu_view.groupAllRender(count);
        },
        tagLevel: function(model){

            if(_.isUndefined(model.tags) || _.isEmpty(model.tags)){
                return;
            }

            var uniq_freq = [];
            var max,min;

            _.each(model.tags, function(value, key){
                var freq = parseInt(value.frequency,10);

                if(!isNaN(freq) && !_.contains(uniq_freq, freq)){
                    uniq_freq.push( freq );
                }
                if(_.isUndefined(max)){
                    max = freq;
                }
                if(_.isUndefined(min)){
                    min = freq;
                }

                if(freq < min ){
                    min = freq;
                }

                if( freq > max ){
                    max = freq;
                }

            });

            var levels = Math.min(this.tagsMaxLevel, uniq_freq.length );

            var step = (max-min)/levels;
            var level_array = [];

            for(var i=0; i< levels; i++){
                level_array[i] = min;
                min+=step;
            }


            _.each(model.tags, function(value, key){
                var freq = parseInt(value.frequency,10);

                value.level = 1;
                for(var i=0; i< levels; i++){
                    if(level_array[i] >= freq){
                        break;
                    }
                    if(i != 0){
                        value.level++;
                    }

                }

            });



        },
        goToGroup:function(){
            var g_id = this.get('id');
            if(!g_id){
                Router.getFirst();
                return;
            }
            Router.navigate( 'group/'+g_id, {trigger: true});
        }
    });

    var GroupsCollection = Backbone.Collection.extend({
        model:GroupModel,
        url:g_settings.base_url + g_settings.collection_group_url
    });


    var PanelView = Backbone.View.extend({
        isManager: false,
        initialize:function(){
            if( !_.isObject( this.alert )){
                this.alert = {};
            }
            this.alert = _.extend({
                template: _.template($('#alert-template').html()),
                delay: 7000,
                container: this.$el.find('.alert-container')
            },this.alert);

            if(!_.isUndefined(this.options.isManager)){
                this.isManager = this.options.isManager;
            }
        },
        renderMessage:function (message, type, delay) {
            if(delay === undefined){
                delay = this.alert.delay;
            }
            type = type || 'error';
            var _class = (type == 'info' ? 'alert-info' : 'alert-error' );
            var alert = $( this.alert.template({ _class:_class, message: message}) );
            this.alert.container.append(alert);
            alert.fadeIn();
            if(delay){
                alert.delay( delay ).fadeOut('slow', function () {
                    $(this).remove();
                });
            }
            return this;
        },
        clearMessage:function () {
            this.alert.container.empty();
            return this;
        },
        events:{
            'click .navigate':   'linkCustomNavigate'
        },
        linkCustomNavigate: function(e){
            e.preventDefault();
            var href = $(e.currentTarget).attr('href');
            if(href){
                Router.navigate( href, {trigger: true});
            }

        }
    });

    var FirstPanelView = PanelView.extend({
        el:$('#first-bar'),
        alert:{},
        creatingGroup:false,
        initialize:function () {
            if( _.isFunction(this.constructor.__super__.initialize) ){
                this.constructor.__super__.initialize.apply(this, arguments);
            }

            this.groups_list = this.$el.find('#groups-list');

            this.group_input = this.$el.find('#group_title');

            this.scrollInit();

            this.groups_list.addClass('big-progress');

            this.collection.on("reset", this.render, this);

            if(this.isManager){
                this.collection.on("add", this.addOne, this);
                this.collection.bind('remove', this.onRemove, this);
                this.collection.bind("change", this.onModelChange, this);
            }

            this.collection.fetch().done(function(){
                Backbone.history.start({pushState: true, root: g_settings.current_root_url})
            });
        },
        groupLock: function(status){
            this.creatingGroup = status;
            this.$el.find('#create_group').prop('disabled', status);
        },
        isGroupLock:function(){
          return this.creatingGroup;
        },
        scrollInit:function(){
            this.scroll_pane = this.$el.find('.scroll-pane');
            this.scroll_pane.jScrollPane({autoReinitialise: true});
        },
        templates:{
            "one_group": _.template($('#group-template').html())

        },
        events:function(){
            var events = {};
            if(this.isManager){
                events = {
                    'click #create_group':   'createGroup',
                    'keypress #group_title': 'createGroupOnKeypress'
                };
            }
            return _.extend({},this.constructor.__super__.events, events);
        },
        createGroupOnKeypress:function(e){
            var key = e.keyCode ? e.keyCode : e.which;
            if(key == 13){
                this.createGroup();
            }
        },
        createGroup:function () {
            if(this.isGroupLock() || !this.isManager){
                return;
            }
            this.groupLock(true);

            var _this = this;
            var group_name = this.group_input.val();
            var new_group = new GroupModel({name:group_name});

            new_group.save().always(function(){
                _this.groupLock(false);
            }).error(function(resp){
                    if(resp || resp.responseText ){
                        var json = JSON.parse(resp.responseText);
                        if(json.msg){
                            _this.renderMessage(json.msg);
                        }

                    }
            }).success(function(resp) {
                    if (new_group.has('id')) {
                        _this.group_input.val('');
                        GroupList.add(new_group, {at:0});
                        if(resp.msg){
                            _this.renderMessage(resp.msg, 'info');
                        }
                    }
                });

        },
        highlight: function(model){
            this.groups_list.find('li.active').removeClass('active');
            this.findModelView(model).addClass('active');
        },
        render:function () {
            this.groups_list.removeClass('big-progress');
            var collecion = this;
            var renderedContent = '';
            this.collection.each(function (model) {
                renderedContent += collecion.renderOneModel(model);
            });

            this.groups_list.html(renderedContent);
            return this;
        },
        addOne:function (model, collection, options) {
            this.groups_list.prepend(this.renderOneModel(model));
            if(!Views.SecondBar.isRendered){
                Router.getFirst();
            }
        },
        onModelChange:function(model, collection, options){
            this.findModelView(model).replaceWith( this.renderOneModel(model) );
        },
        renderOneModel:function (model) {
            return this.templates.one_group(_.extend(model.toJSON(),{cid:model.cid}) );
        },
        findModelView:function(model){
            return this.$el.find('[data-model="'+model.cid+'"]');
        },
        onRemove: function(model, collection, options){
            this.findModelView(model).remove();
        }

    });

    var SecondPanelView = PanelView.extend({
        el:$('#second-bar'),
        view:null,
        model:null,
        lockedModels: {},
        initialize:function () {
            if( _.isFunction(this.constructor.__super__.initialize) ){
                this.constructor.__super__.initialize.apply(this, arguments);
            }
            this.body = this.$el.find('#second-bar-content');
            this.body.addClass('big-progress');
        },
        events:function(){
            //idea edit
            var events = {
                'click #btn-idea-delete-cancel': 'clearMessage',
                'click #btn-delete-idea': function(){
                    if(_.isObject(this.view) && _.isFunction(this.view.ideaDelete) ){
                        this.view.ideaDelete();
                    }
                }
            };

            if(this.isManager){
                //group edit
                events = _.extend(events, {
                    'click #btn-delete-group': function(){
                        if(_.isObject(this.view)  && _.isFunction(this.view.delete_group) ){
                            this.view.delete_group();
                        }
                    },
                    'click #btn-group-delete-cancel': 'clearMessage',
                });
            }


            return _.extend({},this.constructor.__super__.events, events);
        },
        setGroup: function(model){
            this.clearView();
            this.model = model;
            this.view = new groupView({el: this.body, model: this.model, parent:this});
            this.view.render();
        },
        setIdea: function(model, related_group){
            this.clearView();
            this.model = model;
            this.view = new ideaView({el: this.body, model: this.model, parent:this, related_group: related_group});
            this.view.render();
        },
        setIdeaEdit: function(model, related_group){
            this.clearView();
            this.model = model;
            this.view = new ideaEditView({el: this.body, model: this.model, parent:this, related_group: related_group});
            this.view.render();
        },
        clearView: function(){
            if(_.isObject(this.view)){
                this.view.remove();
                this.view = null;
            }
            if(_.isObject(this.model)){
                this.model = null;
            }
            this.body.addClass('big-progress');
            //this.clearMessage();
        },
        modelLock:function(status, model){
            var model_id = model.type+model.get('id');

            if(_.isUndefined(status)){
                status = false;
            }

            if(status){
                this.lockedModels[model_id] = true;
            } else {
                if(!_.isUndefined( this.lockedModels[model_id])){
                    delete this.lockedModels[model_id];
                }
            }
        },
        isModelLock:function(model){
            var model_id = model.type+model.get('id');
            return (!_.isUndefined( this.lockedModels[model_id] ) && this.lockedModels[model_id]  );
        }

    });


    var groupView = Backbone.View.extend({
        isRendered: false,
        ideaStatuses: {},
        initialize:function () {
            this.parent = this.options.parent;
            this.isManager = this.parent.isManager;

            if( this.isManager ){
                this.managerTamplates();
            }

            this.prepareToRender();
            this.model.ideaCollection.on("reset", this.renderIdeas, this);


        },
        remove: function() {
            this.$el.empty();
            this.stopListening();
            this.undelegateEvents();
            if(_.isObject( this.model.ideaCollection.last_xhr )){
                this.model.ideaCollection.last_xhr.abort();
            }
            if(!_.isUndefined(this.chart) && _.isObject(this.chart)){
                this.chart.clear();
                this.chart = null;

            }
            this.isRendered = false;
            return this;
        },
        prepareToRender:function(){
            this.$el.html(this.templates.group());
            this.action = this.$el.find('#group-action-bar');
            this.description_1 = this.$el.find('#group-description-1');
            this.description_2 = this.$el.find('#group-description-2');
            this.detail = this.$el.find('#group-detail-container');
            this.ideas_list = this.$el.find('#ideas-list');

        },
        groupLock:function(status){
            this.parent.modelLock(status,this.model)
        },
        isGroupLock:function(){
            return this.parent.isModelLock(this.model);
        },
        render:function(){

            this.renderAction();
            this.renderDescription_1();


            var statistic = this.model.get('statistic');

            if(statistic.ideas_total){

               this.renderDescription_2();
               this.detail.jScrollPane({autoReinitialise: true});

            }

            this.$el.removeClass('big-progress');

            this.isRendered = true;
        },
        renderAction: function(){
            this.action.html( this.templates.group_action_bar(this.model.toJSON()) );
        },
        renderDescription_1:function(){
            this.description_1.empty().addClass('no_border');
            this.renderTags();

            if(this.isManager){
                this.renderStatistic();
            }
        },
        renderDescription_2:function(){
            this.description_2.empty();
            this.renderIdeaFilter();
        },
        renderIdeaFilter:function(){
            var statuses = this.model.get('idea_statuses');
            statuses[0] = {title: g_settings.lang.all, val: 0};

            statuses = _.sortBy(statuses, function(value){ return value.val; });

            this.ideaStatuses = statuses;

            var template = this.templates.group_idea_filter_template({'statuses': this.ideaStatuses, current: this.model.ideaCollection.ideaFilter});

            this.description_2.append( template );

            this.filterElement = this.description_2.find('#ideas-filter');
            this.filterText = this.description_2.find('#filter-text-status');


            this.filterElement.selectik({
                width: 172,
                maxItems: 5,
                customScroll:1,
                speedAnimation: 100
            });

            //this.filterElement.trigger('change');

        },
        renderTags: function(){
            var tags = this.model.get('tags');
            if( tags.length ){
                this.description_1.removeClass('no_border').append(this.templates.group_tags_template({tags:tags}));
            }
        },
        renderStatistic:function(){
            var statistic = this.model.get('statistic');
            statistic.id = this.model.get('id');
            if(statistic.ideas_total){
                if(statistic.detail.implem.val){
                    statistic.percent = statistic.detail.implem.val/statistic.ideas_total*100;
                } else {
                    statistic.percent = 0;
                }

            }

            this.description_1.prepend( this.templates.group_statistic( statistic ) );

            if(statistic.ideas_total){
                this.renderChart(statistic.detail);
            }
        },
        renderChart: function(detail_statistic){

            // PIE CHART
                this.chart = new AmCharts.AmPieChart();
                this.chart.dataProvider = _.values(detail_statistic);
                this.chart.titleField = "label";
                this.chart.valueField = "val";
                this.chart.labelsEnabled = false;
                this.chart.radius = 60;
                this.chart.colorField = 'color';
                this.chart.startEffect = '>';

            // LEGEND
                var legend = new AmCharts.AmLegend();
                legend.align = "center";
                legend.markerType = "circle";
                legend.position = 'right';
                legend.valueText = '';

                this.chart.addLegend(legend);

                this.chart.write("group-chart");


        },
        templates:{
            "group": _.template($('#group-detail-template').html()),
            "group_action_bar": _.template($('#group-action-bar').html()),
            "group_tags_template":_.template( $('#group-tags-template').html() ),
            "group_idea_filter_template":_.template( $('#group-ideas-filter-template').html() ),
            'group_ideas_list_template': _.template( $('#group-ideas-list-template').html() )

        },
        managerTamplates:function(){
            this.templates = _.extend(this.templates, {
                "group_delete_confirm": _.template($('#group-delete-confirm').html()),
                "group_edit": _.template($('#group-edit-template').html()),
                "group_statistic": _.template($('#group-statistic').html())
            });
        },
        clearMessage:function(){
            this.parent.clearMessage();
        },
        renderMessage: function(message, type, delay){
            this.parent.renderMessage(message, type, delay);
        },
        events:function(){
            var events = {
                'change #ideas-filter': "filter_ideas"
            };

            if(this.isManager){

                events = _.extend(events, {
                    'click #edit-group':   'edit_group',
                    'click #save-edited-group': 'save_editeg_group',
                    'click #cancel-edit-group': 'renderAction',
                    'click #btn-group-delete-confirm':   'delete_group_confirm'
                });

            }

            return events;
        },
        edit_group:function(){
            if( this.isGroupLock() || !this.isManager || !this.isRendered ){
                return;
            }
            this.action.html( this.templates.group_edit(this.model.toJSON()) );
        },
        save_editeg_group: function(){
            if(this.isGroupLock() ){
                return;
            }

            this.groupLock(true);

            var _this = this;
            var new_name = this.action.find('#new_group_name').val();

            this.renderAction();

            if(new_name == this.model.get('name') ){
                this.groupLock(false);
                return;
            }

            this.$el.addClass('big-progress');

            this.model.save({name: new_name},{
                wait: true,
                success: function(model, resp, options) {
                    if(resp.msg){
                        _this.renderMessage(resp.msg, 'info');
                        Views.FirstBar.renderMessage(resp.msg, 'info');

                        if(_this.model == _this.parent.model){
                            _this.parent.view.renderAction();
                        }

                    }
                },
                error: function(model, resp, options) {
                    if(resp || resp.responseText ){
                        var json = JSON.parse(resp.responseText);
                        if(json.msg){
                            _this.renderMessage(json.msg);
                        }

                    }

                }
            }).always(function(){
                    _this.groupLock(false);
                    _this.$el.removeClass('big-progress');
            });
        },
        delete_group_confirm:function(){

            if( this.isGroupLock() || !this.isManager || !this.isRendered ){
                return;
            }
            this.clearMessage();
            this.renderMessage(this.templates.group_delete_confirm( this.model.toJSON() ) ,'error', false);
        },
        delete_group: function(){
            if( this.isGroupLock() ){
                return;
            }
            this.groupLock(true);
            var _this = this;
            this.clearMessage();

            this.$el.addClass('big-progress');

            this.model.destroy({
                wait: true,
                success: function(model, resp, options) {
                    if(resp.msg){
                        _this.renderMessage(resp.msg, 'info');
                        Views.FirstBar.renderMessage(resp.msg, 'info');
                    }
                    if (!_.isUndefined(resp.group_count)) {
                        model.updateGroupCount(resp.group_count);
                    }
                    if(_this.model == _this.parent.model){
                        _this.remove();
                        Router.getFirst();
                    }

                },
                error: function(model, resp, options) {
                    if(resp || resp.responseText ){
                        var json = JSON.parse(resp.responseText);
                        if(json.msg){
                            _this.renderMessage(json.msg);
                        }

                    }

                }
            }).always(function(){
                    _this.groupLock(false);
                    _this.$el.removeClass('big-progress');
                });
        },
        ideas_get_status_title:function(val){
            var status = _.findWhere(this.ideaStatuses, {val: val});

            if(_.isUndefined(status)  || _.isUndefined(status.title)){
                return '';
            }
            return status.title;
        },
        filter_ideas:function(e){
            var status = $(e.currentTarget).val();
            status = parseInt(status,  10);
            this.setIdeaStatusText(status);
            this.getIdeas(status);
        },
        setIdeaStatusText:function(status){
            var text = this.ideas_get_status_title(status)
            this.filterText.html(text + ' ' +g_settings.lang.ideas);
        },
        getIdeas: function(status){
            var _this = this;

            if(this.model.ideaCollection.ideaFilter == status && !this.model.ideaCollection.resetFilter && this.model.ideaCollection.models.length){
                this.model.ideaCollection.trigger('reset');
                return;
            }

            if(_.isObject( this.model.ideaCollection.last_xhr )){
                _this.model.ideaCollection.last_xhr.abort();
            }

            _this.detail.addClass('big-progress');

            _this.model.ideaCollection.last_xhr = this.model.ideaCollection.fetch({
                data: {
                    filter: status,
                    group: this.model.get('id')
                },
                complete: function(){
                    _this.detail.removeClass('big-progress');
                    _this.model.ideaCollection.ideaFilter = status;
                    _this.model.ideaCollection.resetFilter = false;
                },
                error: function(collection, resp) {
                    if(resp.responseText){
                        _this.renderMessage(resp.responseText);
                    }


                }
            });


        },
        renderIdeas:function(){
            var renderedContent = this.templates.group_ideas_list_template({ideas: this.model.ideaCollection.toJSON(), group_id: this.model.get('id') });
            this.ideas_list.html(renderedContent);
        }


    });


    var ideaView  = Backbone.View.extend({
        initialize:function () {
            var _this = this;
            this.parent = this.options.parent;
            this.isManager = this.parent.isManager;
            this.related_group = this.options.related_group;

            this.isRendered = true;

            this.model.on('error',function(model, resp, options){
                if(resp.responseText){
                    _this.renderMessage(resp.responseText);
                }
                _this.related_group.goToGroup();

            });

            if( !this.model.has('full_view') ){
                this.loadModel();
            }
            if( this.model.commentsCollection.tryLoad ){
                this.model.commentsCollection.last_xhr = this.model.commentsCollection.fetch({data:{idea:this.model.get('id')}}).done(function(){
                    _this.model.commentsCollection.tryLoad = false;
                    _this.renderComments();
                });
            }

        },
        loadModel:function(){
            var _this = this;
            this.model.last_xhr = this.model.fetch({
                silent:true,
                success:function(model, resp){
                    _this.render();

                    model.on('change:votes change:title change:description change:groups change:tags change:files change:follow', function(model,hz,options){
                        //var attrs = options.attrs;

                        var parent_model = _this.diffModels();
                        if( !parent_model ){
                            return;
                        }
                        if(parent_model.cid == _this.model.cid &&
                            _.isObject(_this.parent.view) &&
                            _this.parent.view.isRendered &&
                            _.isFunction(_this.parent.view.renderIdeaBody)
                            ){
                            _this.parent.view.renderIdeaBody();
                        }

                    },_this )
                        .on('change:status', function(model,hz,options){

                            if(_.isObject(_this.related_group)){
                                _this.related_group.fetch();
                                _this.related_group.ideaCollection.resetFilter = true;
                            }
                            //var attrs = options.attrs;
                            var parent_model = _this.diffModels();
                            if( !parent_model ){
                                return;
                            }
                            if(parent_model.cid == _this.model.cid &&
                                _.isObject(_this.parent.view) &&
                                _this.parent.view.isRendered &&
                                _.isFunction(_this.parent.view.renderIdeaHead)){
                                _this.parent.view.renderIdeaHead();
                            }

                        },_this);
                }
            });
            return this.model.last_xhr;
        },
        diffModels:function(){
            if(!_.isObject(this.parent) ||
                !_.isObject(this.parent.view) ||
                !_.isObject(this.parent.view.model) ||
                !_.isObject(this.model) ||
                this.model.type != this.parent.view.model.type ||
                this.model.get('id') != this.parent.view.model.get('id')
                ){
                return false;
            }
            return this.parent.view.model;
        },
        ideaLock:function(status){
            this.parent.modelLock(status,this.model)
        },
        isIdeaLock:function(){
            return this.parent.isModelLock(this.model);
        },
        events:{
            'click #idea_agree':'ideaVoteUp',
            'click #idea_disagree':'ideaVoteDown',
            'click #idea_follow':'ideaFollow',
            'click #idea_unfollow':'ideaUnfollow',
            'click #delete_idea_confirm': 'ideaDeleteConfirm',
            'click #btn-delete-idea': 'ideaDelete',
            'click .idea_switch_status': 'changeIdeaStatus',
            'submit form.add_new_comment_form': 'addNewComment',
            'click .replay': 'toggleCommentForm',
            'click .rating-change': 'changeCommentRating',
            'click .delete-comment': 'deleteComment',
            'click .edit-comment': 'editComment',
            'click .save-changes': 'saveEditedComment'
        },
        changeIdeaStatus:function(e){
            var _this = this;
            if( this.isIdeaLock() || !this.model.get('status_access') || !this.isRendered ){
                return;
            }

            var new_status = $(e.currentTarget).data('status');
            new_status = parseInt(new_status, 10);

            if( isNaN(new_status) ){
                return;
            }

            this.ideaLock(true);

            this.$el.addClass('big-progress');

            this.model.statusUpdate(new_status).always(function(){
                _this.ideaLock(false);
                _this.$el.removeClass('big-progress');
            });

        },
        ideaVoteUp:function(){
            var _this = this;

            if( this.isIdeaLock() || !this.isRendered ){
                return;
            }

            this.ideaLock(true);

            this.$el.addClass('big-progress');

            this.model.vote(1).always(function(){
                _this.ideaLock(false);
                _this.$el.removeClass('big-progress');
            });
        },
        ideaVoteDown:function(){
            var _this = this;

            if( this.isIdeaLock() || !this.isRendered ){
                return;
            }

            this.ideaLock(true);

            this.$el.addClass('big-progress');

            this.model.vote(-1).always(function(){
                _this.ideaLock(false);
                _this.$el.removeClass('big-progress');
            });
        },
        ideaFollow:function(){
            var _this = this;

            if( this.isIdeaLock() || !this.isRendered ){
                return;
            }

            this.ideaLock(true);

            this.$el.addClass('big-progress');

            this.model.follow(1).always(function(){
                _this.ideaLock(false);
                _this.$el.removeClass('big-progress');
            });
        },
        ideaUnfollow:function(){
            var _this = this;

            if( this.isIdeaLock() || !this.isRendered ){
                return;
            }

            this.ideaLock(true);

            this.$el.addClass('big-progress');

            this.model.follow(0).always(function(){
                _this.ideaLock(false);
                _this.$el.removeClass('big-progress');
            });
        },
        ideaDeleteConfirm:function(){

            if( this.isIdeaLock() || !this.model.get('edit_access') || !this.isRendered ){
                return;
            }

            this.clearMessage();
            this.renderMessage(this.templates.one_idea_delete_confirm( ) ,'error', false);
        },
        ideaDelete:function(){
            var _this = this;
            this.clearMessage();

            this.ideaLock(true);

            this.$el.addClass('big-progress');

            this.model.destroy({
                wait: true,
                success: function(model, response) {
                    _this.renderMessage(response.msg, 'info');
                    Router.navigate( 'group/'+_this.related_group.get('id'), {trigger: true});
            }}).always(function(){
                    _this.ideaLock(false);
                    _this.$el.removeClass('big-progress');
                });
        },
        templates:{
            'one_idea_view':_.template( $('#one-idea-view-template').html() ),
            'one_idea_head_view':_.template( $('#one-idea-view-head-template').html() ),
            'one_idea_body_view':_.template( $('#one-idea-view-body-template').html() ),
            'one_idea_delete_confirm':_.template( $('#idea-delete-confirm').html() ),
            'one_idea_view_comment_1st_level':_.template( $('#one-idea-view-comment-1st-level').html() ),
            'one_idea_view_comment_2st_level':_.template( $('#one-idea-view-comment-2st-level').html() ),
            'one_idea_view_comment_rank':_.template( $('#one-idea-view-comment-rank').html() )
        },
        clearMessage:function(){
            this.parent.clearMessage();
        },
        renderMessage: function(message, type, delay){
            this.parent.renderMessage(message, type, delay);
        },
        remove: function() {
            this.$el.empty();
            this.stopListening();
            this.undelegateEvents();

            if(_.isObject(this.model.last_xhr) ){
                this.model.last_xhr.abort();
            }
            if(_.isObject(this.model.commentsCollection.last_xhr) ){
                this.model.commentsCollection.last_xhr.abort();
            }

            this.isRendered = false;
            return this;
        },
        render:function(){
            if( !this.model.has('full_view') || !this.isRendered ){
                return this;
            }

            this.$el.html( this.templates.one_idea_view() );

            Custom.init( this.$el.find('input:checkbox.styled'));

            this.elements = {
                head: this.$el.find('#idea-head'),
                body: this.$el.find('#idea-body'),
                comments: this.$el.find('#comments-container')
            };

            this.$el.removeClass('big-progress');

            this.renderIdeaHead();
            this.renderIdeaBody();


            this.elements.comments.closest('.scroll-pane-two').jScrollPane({autoReinitialise: true});
            this.renderComments();

            return this;
        },
        renderIdeaHead:function(){
            this.elements.head.html( this.templates.one_idea_head_view({model: this.model.toJSON(), group: this.related_group.toJSON()}) );

            if(this.model.get('status_access')){
                this.elements.head.find('#status-change').dropdown();
            }

        },
        renderIdeaBody:function(){
            this.elements.body.html( this.templates.one_idea_body_view({model: this.model.toJSON() }) );
        },
        renderComments:function(){
            var _this = this;
            if(!this.isRendered || _.isUndefined(this.elements) || _.isUndefined(this.elements.comments) ){
               return;
            }
            if(this.model.commentsCollection.tryLoad && !this.model.commentsCollection.count()){
                this.elements.comments.empty();
                this.elements.comments.addClass('big-progress');
                return;
            }

             this.elements.comments.removeClass('big-progress');
             if(!this.model.commentsCollection.count()){
                 this.elements.comments.html( g_settings.lang.no_comments_found );
                 return;
             }

            var rendered_content = '';
            this.model.commentsCollection.each(function (model) {
                rendered_content += _this.renderOneComment(model);
            });

            this.elements.comments.html(rendered_content);
            Custom.init( this.elements.comments.find('input:checkbox.styled'));
        },
        renderOneComment:function(model){
            var json_model = model.toJSON();
            json_model.cid = model.cid;
            if(!_.isUndefined(model.commentsCollection)){
                json_model.children = model.commentsCollection.map(function(model){ var obj =  model.toJSON(); obj.cid = model.cid; return obj; });
            }
            var data = {
                comment:json_model,
                rank_template: this.templates.one_idea_view_comment_rank
            };

            if(json_model.level == 2 ){
                data.parent_id = 0;
                var parent = this.model.commentsCollection.get(json_model.parent);
                if(parent){
                    data.parent_id = parent.cid;
                }
                return this.templates.one_idea_view_comment_2st_level(data);
            }

            data.two_lvl_template = this.templates.one_idea_view_comment_2st_level;

            return this.templates.one_idea_view_comment_1st_level(data);
        },
        addNewComment:function(e){
            var _this = this;
            e.preventDefault();
            var form = $(e.currentTarget);
            var data = form.serializeForm();
            if(!data.text || this.model.commentsCollection.lock ){
                return;
            }

            this.elements.comments.find('.control-group.error').removeClass('error');

            this.model.commentsCollection.lock = true;

            form.find('textarea').addClass('big-progress');

            var Collection = this.model.commentsCollection;

            var parent_comment = form.closest('.one-comment');
            if(parent_comment.length){
                var parent_model = Collection.get(parent_comment.data('comment'));
                if( !_.isUndefined(parent_model)){
                    data.sup_comment_id = parent_model.get('id');
                }
                Collection = parent_model.commentsCollection;
            }

            data.idea_id = this.model.get('id');

            Collection.create(data,{
                success:function(model, resp, options){
                    var comments_count = _this.model.get('comments_count');
                    _this.model.set('comments_count',comments_count+1);
                    form[0].reset();
                    if(data.sup_comment_id){
                        form.hide();
                    }
                    _this.renderNewComment(model);
                    if(!_.isUndefined(parent_model)){
                        parent_comment.find('.children_count:first').html( Collection.size() );
                    }
                },
                error:function(model, resp, options){
                    if(resp.responseText){
                        _this.renderMessage(resp.responseText);
                    }
                    form.find('.control-group').addClass('error');
                },
                complete:function(model, resp, options){
                    _this.model.commentsCollection.lock = false;
                    form.find('.big-progress').removeClass('big-progress');
                }
            });

        },
        deleteComment:function(e){
            var _this = this;
            e.preventDefault();

            if(this.model.commentsCollection.lock ){
                return;
            }
            this.model.commentsCollection.lock = true;

            var target = $(e.currentTarget);


            var Collection = this.model.commentsCollection;


            var _comment = target.closest('.one-comment');
            var comment_id = _comment.data('comment');
            var parent_comment_id = _comment.data('parent');
            if(parent_comment_id){
                var parent_model = Collection.get(parent_comment_id);
                Collection = parent_model.commentsCollection;
            }

            var model = Collection.get(comment_id);

            if(!model){
                this.model.commentsCollection.lock = false;
               return;
            }

            model.destroy({
                wait:true,
                success: function(model, response) {
                    var comments_count = _this.model.get('comments_count');
                    comments_count--;
                    var collection_size = 0;
                    if(model.commentsCollection){
                        collection_size = model.commentsCollection.size();
                    }

                    comments_count -= collection_size;

                    if(comments_count<0){
                        comments_count = 0;
                    }
                    _this.model.set('comments_count', comments_count);

                    _this.renderComments();
                },
                error:function(model, resp, options){
                    if(resp.responseText){
                        _this.renderMessage(resp.responseText);
                    }
                },
                complete:function(model, resp, options){
                    _this.model.commentsCollection.lock = false;
                }
            });

        },
        editComment:function(e){
            var _this = this;
            e.preventDefault();

            this.elements.comments.find('.edit-comment-block').hide();

            var target = $(e.currentTarget);
            var _comment = target.closest('.one-comment');
            var block = _comment.find('form.edit-comment-form .edit-comment-block').eq(0);
            block.show();
        },
        saveEditedComment: function(e){
            var _this = this;
            e.preventDefault();
            var target = $(e.currentTarget);
            var _comment = target.closest('.one-comment');

            var Collection = this.model.commentsCollection;

            var comment_id = _comment.data('comment');
            var parent_comment_id = _comment.data('parent');
            if(parent_comment_id){
                var parent_model = Collection.get(parent_comment_id);
                Collection = parent_model.commentsCollection;
            }

            var model = Collection.get(comment_id);
            if(!model){
                return;
            }

            var block = _comment.find('form.edit-comment-form .edit-comment-block').eq(0);

            var old_text = model.get('text');
            var new_text = block.find('textarea').val();

            block.find('.control-group.error').removeClass('error');

            if(!new_text.length || new_text == old_text){
                block.trigger('blur');
                block.hide();
                return;
            }

            _this.model.commentsCollection.lock = true;

            block.find('textarea').addClass('big-progress');

            model.save({text: new_text},{
                wait:true,
                patch:true,
                success: function(model, response) {

                    block.trigger('blur');
                    block.hide();


                    _this.renderComments();
                },
                error:function(model, resp, options){
                    if(resp.responseText){
                        _this.renderMessage(resp.responseText);
                    }
                    block.find('.control-group').addClass('error');
                },
                complete:function(model, resp, options){
                    block.find('textarea').removeClass('big-progress');
                    _this.model.commentsCollection.lock = false;
                }
            });

        },
        toggleCommentForm:function(e){
            e.preventDefault();
            var form = $(e.currentTarget).closest('.one-comment').find('.add_new_comment_form');
            form.toggle();
        },
        findCommentView: function(model){
            return this.elements.comments.find('[data-comment="'+model.cid+'"]');
        },
        changeCommentRating:function(e){
            var _this = this;
            e.preventDefault();

            var button = $(e.currentTarget);
            var comment_view = button.closest('.one-comment');
            var model_id = comment_view.data('comment');

            var Collection = this.model.commentsCollection;
            var parent = comment_view.parent().closest('.one-comment');
            if(parent.length){
                var parent_model = Collection.get(parent.data('comment'));
                Collection = parent_model.commentsCollection;
            }

            var model = Collection.get(model_id);

            if( _.isUndefined(model) ){
                return;
            }
            var model_view = this.findCommentView(model);
            var vote_control = model_view.addClass('big-progress').find('.position-butt:first');
            vote_control.empty();
            model.vote(button.data('action')).always(function(){
                if(!_this.isRendered){
                    return;
                }
                model_view.removeClass('big-progress');
                vote_control.replaceWith( _this.templates.one_idea_view_comment_rank(model.toJSON()) );
            });
        },
        renderNewComment:function(model){
            if( !this.isRendered ){
                return;
            }
            var renderedCommant = this.renderOneComment(model);

            switch(model.get('level')){
                case 2:
                    var parent = this.model.commentsCollection.get(model.get('parent'));
                    var parent_view = this.findCommentView( parent );
                    parent_view.find('.comment-children').prepend(renderedCommant);
                    break;
                default:
                    this.elements.comments.prepend(renderedCommant);
                    break;
            }

            var element_view = this.findCommentView(model);
            Custom.init( element_view.find('input:checkbox.styled'));

        }

    });

    var ideaEditView = Backbone.View.extend({
        group_limit: g_settings.max_groups,
        initialize:function () {
            var _this = this;
            this.parent = this.options.parent;
            this.isManager = this.parent.isManager;
            this.related_group = this.options.related_group;

            this.isRendered = true;

            this.model.on('error',function(model, resp, options){
                if(resp.responseText){
                    _this.renderMessage(resp.responseText);
                    _this.related_group.goToGroup();
                }

            });

            if( !this.model.has('full_view') ){
                this.loadModel();
            }


        },
        loadModel:function(){
            var _this = this;
            this.model.last_xhr = this.model.fetch({
                silent:true,
                success:function(model, resp){
                    _this.render();
                }
            });
        },
        render:function(){
            if( !this.model.has('full_view') || !this.isRendered ){
                return this;
            }

            if( !this.model.get('edit_access') ){
                this.related_group.goToGroup();
                return;
            }

            var new_template = this.templates.one_idea_edit_add_select_button_template();
            this.$el.html( this.templates.one_idea_edit({model: this.model.toJSON(), group: this.related_group.toJSON(), group_limit:this.group_limit, add_new_template: new_template}) );
            this.group_selectors = this.$el.find('#group-selectors');
            this.files_container = this.$el.find('#idea-files-container');

            this.form = this.$el.find('#idea-form');

            this.renderGroupSelectors();

            this.tagit();

            this.fileUpload();

            this.wysiwygInit();

            this.$el.removeClass('big-progress');


            return this;
        },
        wysiwygInit:function(){
            this.form.find("#idea_description").sceditor({
                plugins: "bbcode",
                toolbar: "bold,italic,underline,strike|color|bulletlist,orderedlist|image,youtube|source",
                emoticonsEnabled: false,
                height: '400px'
            });
        },
        renderGroupSelectors:function(){
            var _this = this;
            var rendered = '';
            var model_groups = this.model.get('groups');



            if(!model_groups.length){
                rendered = this.templates.one_idea_edit_group_list({current:0, groups: g_settings.groups_list, req:true});
            } else {
                var req = true;
                _.each(model_groups, function(group, key){

                    rendered += _this.templates.one_idea_edit_group_list({current: group.id, groups: g_settings.groups_list, req:req});
                    req = false;
                });
            }
            
            this.group_selectors.html(rendered);
            this.group_selectors.find('select.groups_list').selectik({
                width: 172,
                maxItems: 5,
                customScroll:1,
                speedAnimation: 100
            });
        },
        tagit:function(){
            this.$el.find('#idea_tags').tagit({
                placeholderText: "",
                animate: true,
                caseSensitive: false,
                selectFromAvailableTagsOnly: false,
                selectFromAvailableTagsOnlyClearOnError: true,
                maxChars: 30,
                tagSource: function(search, showChoices) {
                    var that = this;
                    $.post(
                        g_settings.base_url + g_settings.get_tags_autocomplete_url,
                        {
                            search: search.term,
                            current: that.identifiers()
                        }
                    ).always(function(response) {
                            var data = $.parseJSON(response);
                            that.options.availableTags = data;
                            showChoices(that._subtractArray(data, that.assignedTags()));
                        });
                }
            });
        },
        fileUpload:function(){
            var _this = this;
            this.$el.find('#idea_upload').fileupload({
                dataType: 'json',
                url: g_settings.base_url + g_settings.upload_attachment_url,
                paramName: 'idea_file',
                maxFileSize: g_settings.max_file_size_idea,
                acceptFileTypes: '/(\.|\/)(' + g_settings.allowed_extensions_idea + ')$/',
                add: function(e, data) {
                    var file = data.files[0];

                    var file_info = cut_filename(file.name, 15);
                    if(!_.isUndefined(file.size)){
                        file_info += ' ' + from_bytes(file.size);
                    }

                    var $upload_block = _this.templates.one_idea_edit_upload_template({title: file.name, info: file_info, progress: true});

                    $upload_block = $($upload_block);

                    $upload_block.find('.cancel').click(function(e) {
                        if (_.isObject(data.jqXHR)) {
                            data.jqXHR.abort();
                        }
                    });

                    _this.files_container.append($upload_block);

                    data.context = $upload_block;
                    data.submit();

                },
                progress: function (e, data) {
                    var progress = parseInt(data.loaded / data.total * 100, 10);
                    var $upload_block = data.context;
                    $upload_block.find('.bar').animate({width: progress + '%'});
                },
                done: function (e, data) {
                    var result = data.result;

                    var $upload_block = data.context;

                    if (result.success) {
                        result = result.result;
                        $upload_block.find('.attach_file i').html('&nbsp;');
                        $upload_block.find('.attach_file span').html(result.download);
                        $upload_block.find('.progress').remove();
                        $upload_block.find('.file-identify').val(parseInt(result.id, 10));
                    } else {
                        var $error = _this.templates.one_idea_edit_upload_failed_template({text: g_settings.lang.upload_failed, title: result.error});
                        $error = $($error);
                        $error.tooltip();
                        $upload_block.find('.progress').replaceWith($error);
                    }
                },
                fail: function (e, data) {
                    var $upload_block = data.context;
                    var message = null;
                    var file = data.files[0];
                    if (file.error !== undefined) {
                        switch(file.error) {
                            case 'files_exceeded':
                                message = g_settings.idea_lang_upload_files_exceeded;
                                break;
                            case 'not_allowed':
                                message = g_settings.idea_lang_upload_not_allowed;
                                break;
                            case 'too_big':
                                message = g_settings.idea_lang_upload_too_big;
                                break;
                            case 'too_small':
                                message = g_settings.idea_lang_upload_too_small;
                                break;
                        }
                    }
                    var $error = _this.templates.one_idea_edit_upload_failed_template({text: g_settings.lang.upload_failed, title: result.error});
                    $error = $($error);
                    if (message) {
                        $error.attr('title', message).tooltip();
                    }
                    $upload_block.find('.progress').replaceWith($error);
                }
            });
        },
        removeFile:function(e){
            $(e.currentTarget).closest('li').remove();
        },
        addNewGroupSelector:function(){
            var selectors_count = this.group_selectors.find('select.groups_list').length;
            var button = this.$el.find('#idea_add_more_groups');
            if(selectors_count  >= this.group_limit){
                button.remove();
                return;
            }
            var template = this.templates.one_idea_edit_group_list({current:0, groups: g_settings.groups_list, req:false });
            var element = $(template);
            this.group_selectors.append(element );
            selectors_count++;


            element.find('select.groups_list').selectik({
                width: 172,
                maxItems: 5,
                customScroll:1,
                speedAnimation: 100
            });

            if(selectors_count  >= this.group_limit){
                button.remove();
                return;
            }

        },
        removeGroupSelector:function(e){
            var selectors_count = this.group_selectors.find('select.groups_list').length;
            if(selectors_count == 1){
               return;
            }

            $(e.currentTarget).closest('.select-container').remove();

            selectors_count--;

            if( selectors_count < this.group_limit && !this.$el.find('#idea_add_more_groups').length ){
                var new_template = this.templates.one_idea_edit_add_select_button_template();
                this.group_selectors.after( new_template );
            }

        },
        ideaSave:function(){
            var _this = this;

            if( _this.isIdeaLock() || !_this.model.get('edit_access')){
                return;
            }

            _this.$el.addClass('big-progress');

            _this.form.find('.control-group.error').removeClass('error');

            _this.ideaLock(true);

            var data = this.form.serializeForm(),
                $description = $("#idea_description");
         
            if($description.sceditor)
            { 
               data['idea_description'] = $description.sceditor('instance').getWysiwygEditorValue();         
            } 

            data['idea_id'] = _this.model.get('id');
            
            $.post(g_settings.base_url+g_settings.save_url, data, null, 'json').always(function(response, textStatus){

                if( textStatus != 'success'){
                    _this.ideaLock(false);
                    _this.$el.removeClass('big-progress');
                    _this.renderMessage(g_settings.lang.connection_error);
                    return;
                }

                if(response.success){
                    _this.renderMessage(g_settings.lang.idea_saved, 'info');

                    _this.model.fetch().always(function(){
                        _this.ideaLock(false);
                        _this.$el.removeClass('big-progress');
                    }).done(function(){

                            Router.navigate( 'group/'+_this.related_group.get('id')+'/idea/'+_this.model.get('id'), {trigger: true});

                    });

                } else {

                    var errors = $.parseJSON(response.error);
                    for (var key in errors) {
                        var name = errors[key];
                        var $field = _this.form.find('[name="' + name + '"]');
                        if( ! $field.length) {
                            $field = _this.form.find('[name^="' + name + '"]');
                        }
                        if( ! $field.length) {
                            $field = _this.form.find('[name$="' + name + '"]');
                        }
                        $field.closest('.control-group').addClass('error');
                    }

                    _this.renderMessage(g_settings.lang.idea_save_error);

                }

            });
            /*this.model.save({},{
                attrs:this.form.serializeForm(),
                wait: true,
            });*/

        },
        ideaLock:function(status){
            this.parent.modelLock(status,this.model)
        },
        isIdeaLock:function(){
            return this.parent.isModelLock(this.model);
        },
        remove: function() {
            this.$el.empty();
            this.stopListening();
            this.undelegateEvents();

            this.isRendered = false;
            return this;
        },
        templates:{
            'one_idea_edit': _.template( $('#one-idea-edit-template').html() ),
            'one_idea_edit_group_list': _.template( $('#one-idea-edit-group_list-template').html() ),
            'one_idea_edit_upload_template': _.template( $('#one-idea-edit-upload-template').html() ),
            'one_idea_edit_upload_failed_template': _.template( $('#one-idea-edit-upload-filed-template').html() ),
            'one_idea_edit_add_select_button_template': _.template( $('#one-idea-edit-add-select-button-template').html() )
        },
        events:{
          'click #idea_add_more_groups': 'addNewGroupSelector',
          'click .group_list_remove': 'removeGroupSelector',
          'click #idea_submit': 'ideaSave',
          'click .file_download .cancel' : 'removeFile'
        },
        clearMessage:function(){
            this.parent.clearMessage();
        },
        renderMessage: function(message, type, delay){
            this.parent.renderMessage(message, type, delay);
        }
    });

    var MenuView = Backbone.View.extend({
        el:$('ul.menu'),
        initialize:function () {
            this.groupInit();
        },
        groupInit:function(){
            this.group__all = this.$el.find('.groups-all');
            this.group__all_counter = this.group__all.find('.col');
            if (!this.group__all_counter.length) {
                this.group__all_counter = $('<span class="col"></span>').appendTo(this.group__all);
            }
        },
        groupAllRender:function (count) {
            this.group__all_counter.html(count);
        }
    });


    var PageRouter = Backbone.Router.extend({
        routes: {
            "": "getFirst",
            "group/:number": "groupInfo",
            "group/:number/idea/:number": "ideaInfo",
            "group/:number/idea/:number/edit": "ideaEdit"
        },
        getFirst:function(){
            var first_model = GroupList.first();
            if(first_model != undefined){
                this.navigate( 'group/'+first_model.get('id'), {trigger: true});
            }
        },
        groupInfo: function(id){
            var this_group =  GroupList.get(id);
            if(this_group == undefined){
                this.getFirst();
                return;
            }
            Views.FirstBar.highlight(this_group);
            Views.SecondBar.setGroup(this_group);
        },
        ideaInfo:function(group_id, idea_id){
            var this_group =  GroupList.get(group_id);
            if(_.isUndefined(this_group)){
                this.getFirst();
                return;
            }

            Views.FirstBar.highlight(this_group);

            var idea = this_group.ideaCollection.get(idea_id);

            if(!idea) {
                idea = new ideaModel({id: idea_id});
                this_group.ideaCollection.add( idea );
                this_group.ideaCollection.resetFilter=true;
            }


            Views.SecondBar.setIdea(idea, this_group);

        },
        ideaEdit:function(group_id, idea_id){

            var this_group =  GroupList.get(group_id);
            if(_.isUndefined(this_group)){
                this.getFirst();
                return;
            }

            Views.FirstBar.highlight(this_group);

            var idea = this_group.ideaCollection.get(idea_id);

            if(!idea) {
                idea = new ideaModel({id: idea_id});
                this_group.ideaCollection.add( idea);
                this_group.ideaCollection.resetFilter=true;
            }

            Views.SecondBar.setIdeaEdit(idea, this_group);
        }
    });


    var GroupList = new GroupsCollection;
    Window.GroupList = GroupList;

    var Views = {
        group_menu_view:new MenuView,
       FirstBar:new FirstPanelView({collection: GroupList, isManager:g_settings.is_manager}),
       SecondBar: new SecondPanelView({isManager:g_settings.is_manager})
    }
    Window.Views = Views;

    var Router = new PageRouter;
    Window.Router = Router;



})(jQuery, _, Backbone);