chorus.views.WorkfileSidebar = chorus.views.Sidebar.extend({
    constructorName: "WorkfileSidebar",
    templateName:"workfile_sidebar",
    useLoadingSection:true,

    options: {
        showEditingLinks: true
    },
    subviews:{
        '.tab_control': 'tabs',
        '.multiple_selection': 'multiSelect'
    },

    events: {
        "click .edit_tags": 'editTags',
        "click a.version_list": 'displayVersionList'
    },

    setup:function () {
        this.subscriptions.push(chorus.PageEvents.subscribe("workfile:selected", this.setWorkfile, this));
        this.subscriptions.push(chorus.PageEvents.subscribe("workfile:deselected", this.unsetWorkfile, this));
        this.multiSelect = new chorus.views.MultipleSelectionSidebarMenu({
            selectEvent: "workfile:checked",
            actions: [
                '<a class="edit_tags">{{t "sidebar.edit_tags"}}</a>'
            ]
        });
        this.registerSubView(this.multiSelect);

        this.tabs = new chorus.views.TabControl();

        if(this.model) {
            this.setWorkfile(this.model);
        }
    },

    setWorkfile:function (workfile) {
        this.resource = this.model = workfile;
        if (this.model) {
            this.collection = this.model.activities();
            this.bindings.add(this.collection, "reset", this.render);
            this.bindings.add(this.collection, "changed", this.render);
            this.bindings.add(this.model, "changed", this.render);
            this.collection.fetch();

            if(this.options.showVersions) {
                this.allVersions = this.model.allVersions();
                this.versionList = new chorus.views.WorkfileVersionList({collection:this.allVersions});
                this.bindings.add(this.model, "invalidated", this.allVersions.fetch, this.allVersions);
                this.bindings.add(this.allVersions, "changed", this.render);

                this.allVersions.fetch();
                chorus.PageEvents.subscribe("workfile_version:deleted", this.versionDestroyed, this);
            }

            chorus.PageEvents.subscribe("datasetSelected", this.jumpToTop, this);
            chorus.PageEvents.subscribe("dataset:back", this.recalculateScrolling, this);

            this.tabs.activity = new chorus.views.ActivityList({
                collection:this.collection,
                additionalClass:"sidebar",
                displayStyle:['without_object', 'without_workspace']
            });
            this.tabs.bind("selected", _.bind(this.recalculateScrolling, this));

            this.bindings.add(this.model, "loaded", this.modelLoaded);
        } else {
            delete this.collection;
            delete this.allVersions;
            delete this.tabs.activity;
        }

        this.render();
    },

    modelLoaded:function () {
        if (this.options.showSchemaTabs && this.model.isSql() && this.model.workspace().isActive()) {
            this.tabs.tabNames = ["datasets_and_columns","database_function_list","activity"];
            var schema = this.model.executionSchema();
            this.tabs.database_function_list = new chorus.views.DatabaseFunctionSidebarList({ schema: schema });
            this.tabs.datasets_and_columns = new chorus.views.DatasetAndColumnList({ model: schema });
        } else {
            this.tabs.tabNames = ["activity"];
        }

        this.tabs.activity = new chorus.views.ActivityList({
            collection: this.collection,
            additionalClass: "sidebar",
            displayStyle: ['without_object', 'without_workspace']
        });
        this.tabs.bind("selected", _.bind(this.recalculateScrolling, this));
    },

    unsetWorkfile: function(){
        this.setWorkfile(undefined);
    },

    additionalContext:function () {
        var workspaceActive = this.model && this.model.workspace().isActive();
        var ctx = {
            showAddNoteLink: workspaceActive && this.options.showEditingLinks,
            showCopyLink: true,
            showDownloadLink: true,
            showDeleteLink: workspaceActive && this.options.showEditingLinks && this.model.workspace().canUpdate(),
            showUpdatedTime: true,
            showVersions: this.options.showVersions
        };

        if (this.model) {
            ctx.downloadUrl = this.model.downloadUrl();
            if(this.model.isTableau()) {
                ctx.showCopyLink = false;
                ctx.showDownloadLink = false;
                ctx.showDeleteLink = false;
                ctx.showUpdatedTime = false;
                ctx.showVersions = false;
            }
            _.extend(ctx, this.modifierContext());
        }
        return ctx;
    },

    modifierContext: function() {
        var modifier = this.model.modifier();
        return {
            updatedBy: modifier.displayShortName(),
            modifierUrl: modifier.showUrl()
        };
    },

    postRender:function () {
        if(this.options.showVersions) {
            var versionList = this.versionList.render();
            chorus.menu(this.$('a.version_list'), {
                content:$(versionList.el)
            });
        }
        this._super('postRender');
    },

    versionDestroyed: function(versionNumber) {
        if(versionNumber === this.model.get("versionInfo").versionNum) {
            chorus.router.navigate(this.model.baseShowUrl());
        } else {
            this.allVersions.fetch();
        }
    },

    displayVersionList:function (e) {
        e.preventDefault();
    },

    editTags: function(e) {
        e.preventDefault();
        var dialog = new chorus.dialogs.EditTags({collection: this.multiSelect.selectedModels});
        dialog.launchModal();
    }
});
