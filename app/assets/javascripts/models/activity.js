(function() {
    var CLASS_MAP = {
        "actor": "User",
        "dataset": "WorkspaceDataset",
        'dataSource': 'DynamicDataSource',
        "gnipDataSource": "GnipDataSource",
        "newOwner": "User",
        "hdfsDataSource": "HdfsDataSource",
        "hdfsDataset": "HdfsDataset",
        "workfile": "Workfile",
        "workspace": "Workspace",
        "newUser" : "User",
        "noteObject" : "NoteObject",
        "hdfsEntry" : "HdfsEntry",
        "member": "User",
        "sourceDataset": "WorkspaceDataset",
        "schema": "Schema",
        "job": "Job",
        "jobResult": "JobResult",
        "milestone" : "Milestone"
    };

    function makeAssociationMethod(associate, setupFunction) {
        return function() {
            var model;

            if ( associate === 'dataset' && this.get(associate)) {
                model = new chorus.models.DynamicDataset(this.get(associate));
            } else {
                var className = CLASS_MAP[associate];
                var modelClass = chorus.models[className];
                model = new modelClass(this.get(associate));
            }

            if (setupFunction) setupFunction.call(this, model);
            return model;
        };
    }

    chorus.models.Activity = chorus.models.Base.extend({
        constructorName: "Activity",
        urlTemplate: "activities/{{id}}",

        author: function() {
            if (!this._author) {
                if (this.has("author")) {
                    this._author = new chorus.models.User(this.get("author"));
                } else if (this.has("actor")) {
                    this._author = new chorus.models.User(this.get("actor"));
                }
            }

            return this._author;
        },

        newOwner: makeAssociationMethod("newOwner"),
        workspace: makeAssociationMethod("workspace"),
        schema: makeAssociationMethod("schema"),
        actor: makeAssociationMethod("actor"),
        dataSource: makeAssociationMethod('dataSource'),
        gnipDataSource: makeAssociationMethod("gnipDataSource"),
        hdfsDataSource: makeAssociationMethod("hdfsDataSource"),
        workfile: makeAssociationMethod("workfile"),
        newUser: makeAssociationMethod("newUser"),
        member: makeAssociationMethod("member"),
        job: makeAssociationMethod("job"),
        milestone: makeAssociationMethod("milestone"),

        jobResult: makeAssociationMethod("jobResult", function (model) {
            model.set({job: this.get("job")}, {silent: true});
        }),

        dataset: makeAssociationMethod("dataset", function(model) {
            model.set({workspace: this.get("workspace")}, {silent: true});
        }),

        importSource: makeAssociationMethod("sourceDataset", function(model) {
            model.set({workspace: this.get("workspace")}, {silent: true});
        }),

        hdfsEntry: makeAssociationMethod("hdfsEntry", function(model) {
            var hdfsEntry = this.get("hdfsEntry");
            model.set({
                id : hdfsEntry.id,
                hdfsDataSource: hdfsEntry.hdfsDataSource
            });
        }),

        hdfsDataset: makeAssociationMethod("hdfsDataset", function (model) {
            model.set({workspace: this.get("workspace")}, {silent: true});
        }),


        noteObject: function() {
            var model;

            switch (this.get("actionType")) {
            case "NoteOnHdfsDataSource":
                model = new chorus.models.HdfsDataSource();
                model.set(this.get("hdfsDataSource"));
                break;
            case "NoteOnDataSource":
                model = new chorus.models.DynamicDataSource(this.get("dataSource"));
                break;
            case "NoteOnGnipDataSource":
                model = new chorus.models.GnipDataSource();
                model.set(this.get("gnipDataSource"));
                break;
            case "NoteOnHdfsFile":
                model = new chorus.models.HdfsEntry();
                model.set(this.get("hdfsFile"));
                break;
            case "NoteOnWorkspace":
                model = new chorus.models.Workspace();
                model.set(this.get("workspace"));
                break;
            case "NoteOnDataset":
                model = new chorus.models.DynamicDataset(this.get("dataset"));
                break;
            case "NoteOnWorkspaceDataset":
                model = new chorus.models.WorkspaceDataset();
                model.set(this.get("dataset"));
                model.setWorkspace(this.get("workspace"));
                break;
            case "NoteOnWorkfile":
                model = new chorus.models.Workfile();
                model.set(this.get("workfile"));
                break;
            }
            return model;
        },

        comments: function() {
            this._comments || (this._comments = new chorus.collections.CommentSet(
                this.get("comments"), {
                    entityType: this.collection && this.collection.attributes.entityType,
                    entityId: this.collection && this.collection.attributes.entityId
                }
            ));
            return this._comments;
        },

        promoteToInsight: function(options) {
            var insight = new chorus.models.Insight({
                noteId: this.get("id"),
                action: "create"
            });
            insight.bind("saved", function() {
                this.fetch();
                if (options && options.success) {
                    options.success(this);
                }
            }, this);

            insight.save({ validateBody: false });
        },


        demoteFromInsight: function() {
            this.set({isInsight: false});
            new chorus.models.Insight({id: this.id, action: 'destroy'}).destroy();
        },

        publish: function() {
            var insight = new chorus.models.Insight({
                noteId: this.get("id"),
                action: "publish"
            });

            insight.bind("saved", function() {
                this.fetch();
            }, this);

            insight.save({validateBody: false}, {method: 'create'});
            chorus.toast("insight.publish.success.toast", {toastOpts: {type: "success"}});
        },

        unpublish: function() {
            var insight = new chorus.models.Insight({
                noteId: this.get("id"),
                action: "unpublish"
            });

            insight.bind("saved", function() {
                this.fetch();
            }, this);

            insight.save({validateBody: false}, {method: 'create'});
            chorus.toast("insight.unpublish.success.toast", {toastOpts: {type: "deletion"}});
        },

        toNote: function() {
            var comment = new chorus.models.Note({
                id: this.id,
                body: this.get("body")
            });

            return comment;
        },

        attachments: function() {
            if (!this._attachments) {
                this._attachments = _.map(this.get("attachments"), function(attachment) {
                    var klass;
                    switch (attachment.entityType) {
                    case 'workfile':
                        klass = chorus.models.DynamicWorkfile;
                        break;
                    case 'dataset':
                        klass = chorus.models.WorkspaceDataset;
                        break;
                    case 'work_flow_result':
                        klass = chorus.models.WorkFlowResult;
                        break;
                    default:
                        klass = chorus.models.Attachment;
                        break;
                    }
                    return new klass(attachment);
                });
            }
            return this._attachments;
        },

        isNote: function() {
            return this.get("action") === "NOTE";
        },

        canBePromotedToInsight: function() {
            return this.isNote() && !this.isInsight();
        },

        canBeDemotedBy: function(user) {
            return this.isInsight() && (user.id === this.promoter().id || user.isAdmin() || user.id === this.workspace().owner().id);
        },

        isInsight: function() {
            return this.get("isInsight");
        },

        isSubComment: function() {
            return this.get("action") === "SUB_COMMENT";
        },

        hasCommitMessage: function() {
            return this.get("commitMessage");
        },

        isUserGenerated: function () {
            return this.isNote() || this.isInsight() || this.isSubComment();
        },

        isPublished: function() {
            return this.get("isPublished");
        },

        isOwner: function() {
            return (this.actor().id === chorus.session.user().id);
        },

        isFailure: function() {
            var failureActions = [
                "CredentialsInvalid",
                "GnipStreamImportFailed",
                "FileImportFailed",
                "WorkspaceImportFailed",
                "SchemaImportFailed",
                "HdfsImportFailed"
            ];

            return _.contains(failureActions, this.get("action"));
        },

        isSuccessfulImport: function() {
            var successActions = [
                "GnipStreamImportSuccess",
                "FileImportSuccess",
                "WorkspaceImportSuccess",
                "SchemaImportSuccess",
                "HdfsImportSuccess"
            ];

            return _.contains(successActions, this.get("action"));
        },

        isHdfsImport: function() {
            return this.get("action") === "HdfsImportSuccess";
        },

        promoterLink: function() {
            var promoter = this.promoter();
            return promoter ? Handlebars.helpers.userProfileLink(promoter) : "MISSING PROMOTER";
        },

        promoter: function () {
            return this.get("promotedBy") ? new chorus.models.User(this.get("promotedBy")) : null;
        },

        promotionTimestamp:function() {
            return this.get("promotionTime") ? Handlebars.helpers.relativeTimestamp(this.get("promotionTime")) : null;
        },

        reindexError: function() {
            if (this.isFailure()) {
                this.attributes['errorModelId'] = this.get("id");
            }
        }
    });
})();
