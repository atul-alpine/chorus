chorus.views.TagListSidebar = chorus.views.Sidebar.extend({
    constructorName: 'TagListSidebar',
    templateName: 'tag_list_sidebar',

    events: {
        "click .action_delete_tag" : "deleteSelectedTag",
        "click .action_rename_tag" : "renameSelectedTag"
    },

    setup: function() {
        this.subscribePageEvent('tag:selected', function(tag) {
            this.setTag(tag);
        });
        this.subscribePageEvent('tag:deselected', function() {
            this.setTag(null);
        });
    },

    setTag: function(tag) {
        this.tag = tag;
        this.render();
    },

    additionalContext: function() {
        return {
            hasTag: this.tag !== null && this.tag !== undefined,
            name: this.tag && this.tag.get('name')
        };
    },

    deleteSelectedTag: function(e) {
        e.preventDefault();
        new chorus.alerts.TagDelete({ model: this.tag }).launchModal();
    },

    renameSelectedTag: function(e) {
        e.preventDefault();
        new chorus.dialogs.RenameTag({ model: this.tag }).launchModal();
    }
});
