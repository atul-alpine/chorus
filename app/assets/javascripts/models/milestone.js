chorus.models.Milestone = chorus.models.Base.extend({
    entityType: "Milestone",
    constructorName: "Milestone",
    urlTemplate: "workspaces/{{workspace.id}}/milestones/{{id}}",
    showUrlTemplate: "workspaces/{{workspace.id}}/milestones",

    workspace: function() {
        if (!this._workspace && this.get("workspace")) {
            this._workspace = new chorus.models.Workspace(this.get("workspace"));
        }
        return this._workspace;
    },

    toggleState: function () {
        if (this.get('state') === 'planned') {
            this.save( {state: 'achieved'}, {wait: true} );
        } else {
            this.save( {state: 'planned'}, {wait: true} );
        }
    },

    milestoneState: function () {
      this.state();
    }
});