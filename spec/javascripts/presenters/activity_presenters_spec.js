describe("chorus.presenters.Activity", function() {
    function linkTo(url, text, attributes) {
        return Handlebars.helpers.linkTo(url, text, attributes);
    }

    function itHasTheActorIcon() {
        describe("the icon", function() {
            it("shows the user's icon", function() {
                expect(this.presenter.iconSrc()).toBe(this.actor.fetchImageUrl({size: "icon"}));
            });

            it("links to the user's profile", function() {
                expect(this.presenter.iconHref()).toBe(this.actor.showUrl());
            });

            it("has the class 'profile'", function() {
                expect(this.presenter.iconClass()).toBe("profile");
            });
        });
    }

    function itHasTheErrorIcon() {
        describe("the icon", function() {
            it("shows the error icon", function() {
                expect(this.presenter.iconSrc()).toBe("/images/messaging/message_error_med.png"); // to FIX
            });

            it("links to the user's profile", function() {
                expect(this.presenter.iconHref()).toBeNull();
            });

            it("has the class 'profile'", function() {
                expect(this.presenter.iconClass()).toBe("error");
            });
        });
    }

    function itHasTheImportIcon() {
        describe("the icon", function() {
            it("shows the error icon", function() {
                expect(this.presenter.iconSrc()).toBe("/images/jobs/task-import.png");
            });

            it("links to dataset", function() {
                expect(this.presenter.iconHref()).toBe(this.dataset.showUrl());
            });

            it("has the class 'profile'", function() {
                expect(this.presenter.iconClass()).toBe("icon");
            });
        });
    }

    describe("common aspects", function() {
        context("activity with a workspace", function() {
            beforeEach(function() {
                this.model = backboneFixtures.activity.workfileCreated();
                this.workfile = this.model.workfile();
                this.workspace = this.model.workspace();
                this.presenter = new chorus.presenters.Activity(this.model);
                this.actor = this.model.actor();
            });

            it("includes the relative timestamp", function() {
                var relativeTime = Handlebars.helpers.relativeTimestamp(this.model.get("timestamp"));
                expect(this.presenter.timestamp()).toBe(relativeTime);
            });

            describe("#headerHtml", function() {
                it("returns the translation for the first style that matches", function() {
                    this.presenter.options.displayStyle = ["without_object", "without_workspace"];
                    expect(this.presenter.headerHtml().toString()).toContainTranslation(
                        "activity.header.WorkfileCreated.without_workspace", {
                            actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                            workfileLink: linkTo(this.workfile.showUrl(), this.workfile.name())
                        }
                    );
                });

                it("returns the translation for the default style if no style is provided " +
                    "and the model has a valid workspace", function() {
                    this.presenter.options.displayStyle = null;
                    expect(this.presenter.headerHtml().toString()).toContainTranslation(
                        "activity.header.WorkfileCreated.default", {
                            actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                            workfileLink: linkTo(this.workfile.showUrl(), this.workfile.name()),
                            workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                        }
                    );
                });

                it("returns a handlebars safe-string (so that html won't be stripped)", function() {
                    expect(this.presenter.headerHtml()).toBeA(Handlebars.SafeString);
                });
            });
        });

        context("activity without a workspace", function() {
            beforeEach(function() {
                this.model = backboneFixtures.activity.noteOnGreenplumDataSource();
                this.noteObject = this.model.dataSource();
                this.presenter = new chorus.presenters.Activity(this.model);
                this.actor = this.model.actor();
            });

            describe("#headerHtml", function() {
                it("returns the translation for the without_workspace style if no style is provided " +
                    "and the model does not have a valid workspace", function() {
                    this.presenter.options.displayStyle = null;
                    expect(this.presenter.headerHtml().toString()).toContainTranslation(
                        "activity.header.NOTE.without_workspace", {
                            actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                            noteObjectLink: linkTo(this.noteObject.showUrl(), this.noteObject.name()),
                            noteObjectType: "data source"
                        }
                    );
                });
            });
        });

        describe("#canDelete", function() {
            beforeEach(function() {
                this.model = backboneFixtures.activity.noteOnGreenplumDataSource();
                this.presenter = new chorus.presenters.Activity(this.model);
            });

            context("User is admin", function() {
                it("returns true", function() {
                    setLoggedInUser({ admin: true });
                    expect(this.presenter.canDelete()).toBeTruthy();
                });
            });

            context ("user is owner of the note" , function() {
                it("returns true", function() {
                    setLoggedInUser({ admin: false, id: this.model.actor().id });
                    expect(this.presenter.canDelete()).toBeTruthy();
                });
            });

            context ("user is neither owner or admin" , function() {
                it("returns false", function() {
                    setLoggedInUser({ admin: false });
                    expect(this.presenter.canDelete()).toBeFalsy();
                });
            });
        });

        describe("#canEdit", function() {
            beforeEach(function() {
                this.model = backboneFixtures.activity.noteOnGreenplumDataSource();
                this.presenter = new chorus.presenters.Activity(this.model);
            });

            context ("user is owner of the note" , function() {
                it("returns true", function() {
                    setLoggedInUser({ id: this.model.actor().id });
                    expect(this.presenter.canEdit()).toBeTruthy();
                });
            });

            context ("user is not the owner" , function() {
                it("returns false", function() {
                    setLoggedInUser({ id: 12341324 });
                    expect(this.presenter.canEdit()).toBeFalsy();
                });
            });
        });

        describe("#isNote", function() {
            context ("when it is a note" , function() {
                beforeEach(function() {
                    this.model = backboneFixtures.activity.noteOnGreenplumDataSource();
                    this.presenter = new chorus.presenters.Activity(this.model);
                });
                it("returns true", function() {
                    setLoggedInUser({ id: this.model.actor().id });
                    expect(this.presenter.isNote()).toBeTruthy();
                });
            });

            context ("when it is a not a note" , function() {
                beforeEach(function() {
                    this.model = backboneFixtures.activity.dataSourceCreated();
                    this.presenter = new chorus.presenters.Activity(this.model);
                });
                it("returns false", function() {
                    setLoggedInUser({ id: this.model.actor().id });
                    expect(this.presenter.isNote()).toBeFalsy();
                });
            });
        });

        describe("isNotification and isReadOnly", function() {
            beforeEach(function() {
                this.model = backboneFixtures.activity.noteOnGreenplumDataSource();
                var presenter_options = {
                    isNotification: true,
                    isReadOnly: true
                };
                this.presenter = new chorus.presenters.Activity(this.model, presenter_options);
            });
            it('when isNotification is true', function() {
                expect(this.presenter.isNotification()).toEqual(true);
            });
            it('when isReadOnly is true', function() {
                expect(this.presenter.isReadOnly()).toEqual(true);
            });
        });

        describe("#hasError", function() {
            beforeEach(function() {
                this.model = backboneFixtures.activity.noteOnGreenplumDataSource();
            });

            context("when the activity has errorObjects", function() {
                it("is true", function() {
                    this.model = backboneFixtures.activity.datasetImportFailedWithModelErrors();
                    expect(this.model.get("errorObjects")).toBeTruthy();
                    this.presenter = new chorus.presenters.Activity(this.model);
                    expect(this.presenter.hasError()).toBeTruthy();
                });
            });

            context("when the activity has errorMessage", function() {
                it("is true", function() {
                    this.model = backboneFixtures.activity.fileImportFailed();
                    expect(this.model.get("errorMessage")).toBeTruthy();
                    this.presenter = new chorus.presenters.Activity(this.model);
                    expect(this.presenter.hasError()).toBeTruthy();
                });
            });

            context("when the activity has neither", function() {
                it("is false", function() {
                    this.model = backboneFixtures.activity.noteOnGreenplumDataSource();
                    expect(this.model.get("errorObjects")).toBeFalsy();
                    expect(this.model.get("errorMessage")).toBeFalsy();
                    this.presenter = new chorus.presenters.Activity(this.model);
                    expect(this.presenter.hasError()).toBeFalsy();
                });
            });
        });
    });

    describe("#promotionDetails", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.insightOnGreenplumDataSource();
            var presenter_options = {
            };
            this.presenter = new chorus.presenters.Activity(this.model, presenter_options);
        });
        it('shows the promoting user and the promotion timestamp', function() {
            expect(this.presenter.promotionDetails().toString()).toContainTranslation(
                "insight.promoted_by", {
                    relativeTimestamp: this.model.promotionTimestamp(),
                    promoterLink: this.model.promoterLink()
                }
            );
        });
    });

    describe("#isPublished", function() {

        context(" when insight is published", function () {
            beforeEach(function () {
                this.model = backboneFixtures.activity.insightOnGreenplumDataSource({
                    isPublished:true
                });
                var presenter_options = {

                };
                this.presenter = new chorus.presenters.Activity(this.model, presenter_options);
            });

            it('when isPublished is true', function () {
                expect(this.presenter.isPublished()).toBeTruthy();
            });
        });

        context(" when insight is Not published", function () {
            beforeEach(function () {
                this.model = backboneFixtures.activity.insightOnGreenplumDataSource({
                    isPublished:false
                });
                var presenter_options = {
                };
                this.presenter = new chorus.presenters.Activity(this.model, presenter_options);
            });

            it('when isPublished is false', function () {
                expect(this.presenter.isPublished()).toBeFalsy();
            });
        });
    });

    context("data source created", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.dataSourceCreated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.dataSource = this.model.dataSource();
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toContainTranslation(
                "activity.header.DataSourceCreated.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    dataSourceLink: linkTo(this.dataSource.showUrl(), this.dataSource.name())
                }
            );
        });
    });

    context("data source deleted", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.dataSourceDeleted();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.dataSource = this.model.dataSource();
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toContainTranslation(
                "activity.header.DataSourceDeleted.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    dataSourceLink: linkTo(null, this.dataSource.name())
                }
            );
        });
    });

    context('hadoop data source created', function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.hdfsDataSourceCreated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.hdfsDataSource = this.model.hdfsDataSource();
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toContainTranslation(
                "activity.header.HdfsDataSourceCreated.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    hdfsDataSourceLink: linkTo(this.hdfsDataSource.showUrl(), this.hdfsDataSource.name())
                }
            );
        });
    });

    context('gnip data source created', function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.gnipDataSourceCreated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.gnipDataSource = this.model.gnipDataSource();
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toContainTranslation(
                "activity.header.GnipDataSourceCreated.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    gnipDataSourceLink: linkTo(this.gnipDataSource.showUrl(), this.gnipDataSource.name())
                }
            );
        });
    });

    context('relational data source changed owner', function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.dataSourceChangedOwner();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.dataSource = this.model.dataSource();
            this.newOwner = this.model.newOwner();
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toContainTranslation(
                "activity.header.DataSourceChangedOwner.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    dataSourceLink: linkTo(this.dataSource.showUrl(), this.dataSource.name()),
                    newOwnerLink: linkTo(this.newOwner.showUrl(), this.newOwner.name())
                }
            );
        });
    });

    context('relational data source changed name', function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.dataSourceChangedName({
                newName: "jane",
                oldName: "john"
            });
            this.presenter = new chorus.presenters.Activity(this.model);
            this.dataSource = this.model.dataSource();
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toContainTranslation(
                "activity.header.DataSourceChangedName.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    dataSourceLink: linkTo(this.dataSource.showUrl(), this.dataSource.name()),
                    newName: "jane",
                    oldName: "john"
                }
            );
        });
    });

    context('hadoop data source changed name', function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.hdfsDataSourceChangedName({
                newName: "jane",
                oldName: "john"
            });
            this.presenter = new chorus.presenters.Activity(this.model);
            this.dataSource = this.model.hdfsDataSource();
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toContainTranslation(
                "activity.header.HdfsDataSourceChangedName.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    hdfsDataSourceLink: linkTo(this.dataSource.showUrl(), this.dataSource.name()),
                    newName: "jane",
                    oldName: "john"
                }
            );
        });
    });

    context("public workspace created", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.publicWorkspaceCreated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            this.workspace = this.model.workspace();

            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.PublicWorkspaceCreated.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                }
            );
        });
    });

    context("private workspace created", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.privateWorkspaceCreated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            this.workspace = this.model.workspace();

            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.PublicWorkspaceCreated.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                }
            );
        });
    });

    context("workspace made public", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.workspaceMakePublic();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            this.workspace = this.model.workspace();

            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.WorkspaceMakePublic.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                }
            );
        });
    });

    context("workspace made private", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.workspaceMakePrivate();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            this.workspace = this.model.workspace();

            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.WorkspaceMakePrivate.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                }
            );
        });
    });

    context("workspace archived", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.workspaceArchived();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            this.workspace = this.model.workspace();

            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.WorkspaceArchived.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                }
            );
        });

    });

    context("workspace deleted", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.workspaceDeleted({
                workspace :{
                    id: 1,
                    name: "abc",
                    isDeleted: true
                }
            });
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            this.workspace = this.model.workspace();
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.WorkspaceDeleted.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                }
            );
        });

    });

    context("workspace unarchived", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.workspaceUnarchived();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            this.workspace = this.model.workspace();

            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.WorkspaceUnarchived.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                }
            );
        });

    });

    context("workfile created", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.workfileCreated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            this.workfile = this.model.workfile();
            this.workspace = this.model.workspace();

            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.WorkfileCreated.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workfileLink: linkTo(this.workfile.showUrl(), this.workfile.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                }
            );
        });
    });

    context("workfile upgrade version", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.workfileUpgradedVersion();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            this.workfile = this.model.workfile();
            this.workspace = this.workfile.workspace();
            var versionId = this.model.get('versionId');

            var versionedWorkfile = new chorus.models.Workfile({
                versionInfo: {id: versionId},
                id : this.workfile.id,
                workspace: this.workspace
            });

            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.WorkfileUpgradedVersion.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workfileLink: linkTo(this.workfile.showUrl(), this.workfile.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                    versionLink: linkTo(versionedWorkfile.showUrl(), t("workfile.version_title", {versionNum: this.model.get('versionNum') }))
                }
            );
        });

        context("after the workfile has been deleted", function () {
            it("has the right header html", function() {
                this.model.attributes.workfile.isDeleted = true;
                this.workfile = this.model.workfile();
                this.workspace = this.workfile.workspace();

                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.WorkfileUpgradedVersion.default", {
                        actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                        workfileLink: linkTo(this.workfile.showUrl(), this.workfile.name()),
                        workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                        versionLink: linkTo(null, t("workfile.version_title", {versionNum: this.model.get('versionNum') }))
                    }
                );
            });
        });

        context("after only the version has been deleted", function () {
            it("has the right header html", function() {
                this.model.attributes.workfile.isDeleted = false;
                this.model.attributes.versionIsDeleted = true;
                this.workfile = this.model.workfile();
                this.workspace = this.workfile.workspace();

                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.WorkfileUpgradedVersion.default", {
                        actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                        workfileLink: linkTo(this.workfile.showUrl(), this.workfile.name()),
                        workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                        versionLink: linkTo(null, t("workfile.version_title", { versionNum: this.model.get('versionNum') }))
                    }
                );
            });
        });
    });

    context("work flow upgrade version", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.workFlowUpgradedVersion();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            this.workfile = this.model.workfile();
            this.workspace = this.workfile.workspace();

            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.WorkFlowUpgradedVersion.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workfileLink: linkTo(this.workfile.showUrl(), this.workfile.name())
                }
            );
        });
    });

    context("workfile version deleted", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.workfileVersionDeleted();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            this.workfile = this.model.workfile();
            this.workspace = this.workfile.workspace();

            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.WorkfileVersionDeleted.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workfileLink: linkTo(this.workfile.showUrl(), this.workfile.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                    versionNum: this.model.get("versionNum")
                }
            );
        });
    });

    context("datasets associated", function() {
        context("when the dataset is from Hadoop", function () {
            beforeEach(function() {
                this.model = backboneFixtures.activity.sourceTableCreated({dataset: {entitySubtype: 'HDFS', objectType: 'MASK'} });
                this.presenter = new chorus.presenters.Activity(this.model);
                this.actor = this.model.actor();
            });

            itHasTheActorIcon();

            it("has the right header html", function() {
                this.dataset = this.model.dataset();
                this.workspace = this.model.workspace();

                var datasetType     = t("dataset.entitySubtypes.mask");
                var datasetLink     = linkTo(this.dataset.showUrl(), this.dataset.name());
                var workspaceLink   = linkTo(this.workspace.showUrl(), this.workspace.name());
                var actorLink       = linkTo(this.actor.showUrl(), this.actor.name());

                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.SourceTableCreated.default", {
                        actorLink: actorLink,
                        workspaceLink: workspaceLink,
                        datasetLink: datasetLink,
                        datasetType: datasetType
                    }
                );
            });
        });

        context("when the dataset is from a SQL DB", function () {
            beforeEach(function() {
                this.model = backboneFixtures.activity.sourceTableCreated({dataset: {entitySubtype: 'VIEW', objectType: 'VIEW'} });
                this.presenter = new chorus.presenters.Activity(this.model);
                this.actor = this.model.actor();
            });

            itHasTheActorIcon();

            it("has the right header html", function() {
                this.dataset = this.model.dataset();
                this.workspace = this.model.workspace();

                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.SourceTableCreated.default", {
                        actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                        workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                        datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                        datasetType: t("dataset.entitySubtypes.view")
                    }
                );
            });
        });
    });

    context("sandbox added", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.sandboxAdded();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            this.workspace = this.model.workspace();

            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.WorkspaceAddSandbox.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                }
            );
        });
    });

    context("add a hdfs file as external table", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.hdfsFileExtTableCreated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.dataset = this.model.dataset();
            this.hdfsEntry = this.model.hdfsEntry();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.HdfsFileExtTableCreated.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                    hdfsEntryLink: linkTo(this.hdfsEntry.showUrl(), this.hdfsEntry.name()),
                    datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name())
                }
            );
        });
    });

    context("add a hdfs directory as external table", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.hdfsDirectoryExtTableCreated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.dataset = this.model.dataset();
            this.hdfsEntry = this.model.hdfsEntry();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.HdfsDirectoryExtTableCreated.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                    hdfsEntryLink: linkTo(this.hdfsEntry.showUrl(), this.hdfsEntry.name()),
                    datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name())
                }
            );
        });
    });

    context("add a hdfs directory as external table with file pattern", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.hdfsPatternExtTableCreated({filePattern: '*.csv'});
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.dataset = this.model.dataset();
            this.hdfsEntry = this.model.hdfsEntry();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.HdfsPatternExtTableCreated.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                    hdfsEntryLink: linkTo(this.hdfsEntry.showUrl(), this.hdfsEntry.name()),
                    datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                    filePattern: '*.csv'
                }
            );
        });
    });

    context("file import success", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.fileImportSuccess();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.dataset = this.model.dataset();
        });

        itHasTheImportIcon();

        it("has the right header html", function() {
            this.presenter.options.displayStyle = ["without_workspace"];
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.FileImportSuccess.default", {
                    importType: this.model.get("importType"),
                    importSourceLink: this.model.get("fileName"),
                    datasetType: t("dataset.entitySubtypes.table"),
                    datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                }
            );
        });
    });

    context("hdfs imports", function () {
        context("successful imports", function () {
            beforeEach(function () {
                this.model = backboneFixtures.activity.hdfsImportSuccess();
                this.presenter = new chorus.presenters.Activity(this.model);
                this.actor = this.model.actor();
                this.dataset = this.hdfsEntry = this.model.hdfsEntry();
                this.hdfsDataSource = this.model.hdfsDataSource();
            });

            itHasTheImportIcon();

            it("has the right header html", function () {
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.HdfsImportSuccess.default", {
                        hdfsEntryLink: linkTo(this.hdfsEntry.showUrl(), this.hdfsEntry.name()),
                        hdfsDataSourceLink: linkTo(this.hdfsDataSource.showUrl(), this.hdfsDataSource.name())
                    }
                );
            });
        });

        context("failed imports", function () {
            beforeEach(function () {
                this.model = backboneFixtures.activity.hdfsImportFailed();
                this.presenter = new chorus.presenters.Activity(this.model);
                this.actor = this.model.actor();
                this.hdfsDataSource = this.model.hdfsDataSource();
            });

            itHasTheErrorIcon();

            it("has the right header html", function () {
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.HdfsImportFailed.default", {
                        fileName: this.model.get("fileName"),
                        hdfsDataSourceLink: linkTo(this.hdfsDataSource.showUrl(), this.hdfsDataSource.name())
                    }
                );
            });
        });
    });

    context("workspace import success", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.workspaceImportSuccess();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.dataset = this.model.dataset();
            this.sourceDataset = this.model.importSource();
        });

        itHasTheImportIcon();

        it("has the right header html", function() {
            this.presenter.options.displayStyle = ["without_workspace"];
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.WorkspaceImportSuccess.default", {
                    importSourceDatasetLink: linkTo(this.sourceDataset.showUrl(), this.sourceDataset.name()),
                    datasetType: t("dataset.entitySubtypes.table"),
                    datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                }
            );
        });
    });

    context('schema import created', function(){

        beforeEach(function() {
            this.model = backboneFixtures.activity.schemaImportCreated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.schema = this.model.schema();
            this.destination = this.model.dataset();
            this.sourceDataset = new chorus.models.DynamicDataset(this.model.get('sourceDataset'));
        });

        itHasTheActorIcon();

        context("after the destination dataset exists", function(){
            beforeEach(function(){
                this.destination = backboneFixtures.dataset();
                this.model = backboneFixtures.activity.schemaImportCreated({dataset: this.destination});
                this.presenter = new chorus.presenters.Activity(this.model);
            });

            it("has the right header html", function() {
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.SchemaImportCreated.default", {
                        actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                        sourceDatasetInSchemaLink: linkTo(this.sourceDataset.showUrl(), this.sourceDataset.name()),
                        destObjectOrNameInSchema: linkTo(this.destination.showUrl(), this.destination.name()),
                        datasetType: t("dataset.entitySubtypes.table"),
                        schemaLink: linkTo(this.schema.showUrl(), this.schema.name())
                    }
                );
            });
        });

        context("before the destination dataset exists", function(){
            it("has the right header html", function() {
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.SchemaImportCreated.default", {
                        actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                        sourceDatasetInSchemaLink: linkTo(this.sourceDataset.showUrl(), this.sourceDataset.name()),
                        datasetType: t("dataset.entitySubtypes.table"),
                        destObjectOrNameInSchema: this.model.get('destinationTable'),
                        schemaLink: linkTo(this.schema.showUrl(), this.schema.name())
                    }
                );
            });
        });

    });

    context('schema import success', function(){
        beforeEach(function() {
            this.model = backboneFixtures.activity.schemaImportSuccess();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.schema = this.model.dataset().schema();
            this.dataset = this.model.dataset();
            this.sourceDataset = this.model.importSource();
        });

        itHasTheImportIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.SchemaImportSuccess.default", {
                    sourceDatasetInSchemaLink: (new chorus.models.DynamicDataset(this.sourceDataset.attributes)).showLink(),
                    destinationDatasetInSchemaLink: (new chorus.models.DynamicDataset(this.dataset.attributes)).showLink(),
                    destinationSchemaLink: this.dataset.schema().showLink()
                }
            );
        });
    });

    context('schema import failed', function(){
        beforeEach(function() {
            this.model = backboneFixtures.activity.schemaImportFailed();
            this.actor = this.model.actor();
            this.sourceDataset = this.model.importSource();
        });

        context("when the events has a dataset", function() {
            beforeEach(function() {
                this.dataset = this.model.dataset();
                this.presenter = new chorus.presenters.Activity(this.model);
            });

            itHasTheErrorIcon();

            it("has the right header html", function() {
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.SchemaImportFailed.default", {
                        sourceDatasetInSchemaLink: (new chorus.models.DynamicDataset(this.sourceDataset.attributes)).showLink(),
                        destinationSchemaLink: this.dataset.schema().showLink(),
                        destObjectOrNameInSchema: (new chorus.models.DynamicDataset(this.dataset.attributes)).showLink()
                    }
                );
            });
        });

        context("when the events does not have a dataset", function() {
            beforeEach(function() {
                delete this.model.attributes.dataset;
                this.presenter = new chorus.presenters.Activity(this.model);
            });

            itHasTheErrorIcon();

            it("has the right header html", function() {
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.SchemaImportFailed.default", {
                        sourceDatasetInSchemaLink: (new chorus.models.DynamicDataset(this.sourceDataset.attributes)).showLink(),
                        destinationSchemaLink: (new chorus.models.Schema(this.model.get('schema'))).showLink(),
                        destObjectOrNameInSchema: this.model.get('destinationTable')
                    }
                );
            });
        });
    });

    context("file import failed", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.fileImportFailed();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
        });

        itHasTheErrorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.FileImportFailed.default", {
                    importType: this.model.get("importType"),
                    importSourceLink: this.model.get("fileName"),
                    datasetType: t("dataset.entitySubtypes.table"),
                    destObjectOrName: this.model.get('destinationTable'),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                }
            );
        });

        it("has the error link", function() {
            expect(this.presenter.isFailure()).toBe(true);
        });
    });

    context("dataset import failed", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.workspaceImportFailed();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.sourceDataset = this.model.importSource();
        });

        itHasTheErrorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.WorkspaceImportFailed.default", {
                    importSourceDatasetLink: linkTo(this.sourceDataset.showUrl(), this.sourceDataset.name()),
                    datasetType: t("dataset.entitySubtypes.table"),
                    destObjectOrName: this.model.get('destinationTable'),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                }
            );
        });
    });

    context("note on a hdfs file", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.noteOnHdfsFileCreated({
                hdfsFile: { isDir: false, id: 4567, name: "path.csv", hdfsDataSource: {id: 1234}}
            });
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.hdfsFile = backboneFixtures.hdfsDir({
                id: 4567,
                hdfsDataSource: { id: 1234 },
                name: "path.csv",
                isDir: false
            });
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.NOTE.without_workspace", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    noteObjectLink: linkTo(this.hdfsFile.showUrl(), this.hdfsFile.name()),
                    noteObjectType: "file"
                }
            );
        });
    });

    context("note on a workfile", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.noteOnWorkfileCreated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.NOTE.without_workspace", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    noteObjectLink: linkTo(this.model.workfile().showUrl(), this.model.workfile().name()),
                    noteObjectType: "workfile"
                }
            );
        });
    });

    context('note on a gpdb data source', function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.noteOnGreenplumDataSource({
                dataSource: {
                    id: 42,
                    name: 'my_data_source'
                }
            });
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.dataSource = backboneFixtures.gpdbDataSource({id: 42, name: 'my_data_source'});
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.NOTE.without_workspace", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    noteObjectLink: linkTo(this.dataSource.showUrl(), this.dataSource.name()),
                    noteObjectType: "data source"
                }
            );
        });
    });

    context('note on a gnip data source', function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.noteOnGnipDataSourceCreated({
                gnipDataSource: {
                    id: 42,
                    name: 'my_gnip_data_source'
                }
            });
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.dataSource = backboneFixtures.gnipDataSource({id: 42, name: 'my_gnip_data_source'});
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.NOTE.without_workspace", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    noteObjectLink: linkTo(this.dataSource.showUrl(), this.dataSource.name()),
                    noteObjectType: "data source"
                }
            );
        });
    });

    context("note on a workspace ", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.noteOnWorkspaceCreated({
                workspace: {
                    name: 'le_workspace',
                    id: 42
                }
            });
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = backboneFixtures.workspace({id: 42, name: 'le_workspace' });
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.NOTE.without_workspace", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    noteObjectLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                    noteObjectType: "workspace"
                }
            );
        });
    });

    context('note on a hadoop data source', function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.noteOnHdfsDataSourceCreated({
                hdfsDataSource: {
                    id: 42,
                    name: 'my_data_source'
                }
            });
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.dataSource = backboneFixtures.hdfsDataSource({id: 42, name: 'my_data_source'});
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.NOTE.without_workspace", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    noteObjectLink: linkTo(this.dataSource.showUrl(), this.dataSource.name()),
                    noteObjectType: "data source"
                }
            );
        });
    });

    context("note on a dataset", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.noteOnDatasetCreated({
                dataset: { id: 42, objectName: "lunch_boxes" }
            });
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.dataset = this.model.noteObject();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.NOTE.without_workspace", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    noteObjectLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                    noteObjectType: t("dataset.entitySubtypes.table")
                }
            );
        });
    });

    context("note on a workspace dataset", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.noteOnWorkspaceDatasetCreated({
                dataset: { id: 42, objectName: "lunch_boxes" },
                workspace: { id: 55, name: "paleo_eaters" }
            });
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.dataset = this.model.noteObject();
            this.workspace = this.model.workspace();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.NOTE.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    noteObjectLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                    noteObjectType: t("dataset.entitySubtypes.table"),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                }
            );
        });
    });

    context("workspace name change", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.workspaceChangeName({
                workspace: { id: 55, name: "paleo_eaters" },
                workspaceOldName: "old_name"
            });
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.WorkspaceChangeName.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                    workspaceOldName: this.model.get("workspaceOldName")
                }
            );
        });
    });

    context("project status changed", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.projectStatusChanged();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.ProjectStatusChanged.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                    reason: this.model.get("reason"),
                    status: t('workspace.project.status.' + this.model.get("status"))
                }
            );
        });
    });

    context("members added event", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.membersAdded({
                workspace: { id: 55, name: "paleo_eaters" },
                member: { id: 66, firstName: "Susie", lastName: "Cupcake"}
            });
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.member = this.model.member();

            this.activity_data = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                memberLink: linkTo(this.member.showUrl(), this.member.name())
            };
            this.activity_without_workspace_data = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                memberLink: linkTo(this.member.showUrl(), this.member.name())
            };
        });

        context("the actor icon is displayed", function () {
            beforeEach(function() {
                this.presenter = new chorus.presenters.Activity(this.model);
            });
            itHasTheActorIcon();
        });

        context("a single member is added", function() {
            beforeEach(function () {
                this.model.set({numAdded: 1});
                this.presenter = new chorus.presenters.Activity(this.model);
            });

            it("has the right header html for the default style", function() {
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.MembersAdded.one.default",
                    this.activity_data
                );
            });

            it("has the right header html for the without_workspace style", function() {
                this.presenter.options.displayStyle = ["without_workspace"];

                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.MembersAdded.one.without_workspace",
                    this.activity_without_workspace_data
                );
            });
        });

        context("two members are added", function() {
            beforeEach(function () {
                this.model.set({numAdded: 2});
                this.presenter = new chorus.presenters.Activity(this.model);
            });

            it("has the right header html for the default style", function() {
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.MembersAdded.two.default",
                    this.activity_data
                );
            });

            it("has the right header html for the without_workspace style", function() {
                this.presenter.options.displayStyle = ["without_workspace"];

                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.MembersAdded.two.without_workspace",
                    this.activity_without_workspace_data
                );
            });

            it("choose right header for notification if isNotification is set to true", function() {
                this.presenter.options.isNotification = true;
                this.presenter.options.displayStyle = ['default'];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.MembersAdded.notification.default",
                    this.activity_data
                );
            });
        });

        context("more than two members are added", function() {
            beforeEach(function () {
                this.model.set({numAdded: 5});
                this.presenter = new chorus.presenters.Activity(this.model);
            });

            it("has the right header html for the default style", function() {
                this.activity_data["countExcludingNamed"] = this.model.get("numAdded") - 1;
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.MembersAdded.many.default",
                    this.activity_data
                );
            });

            it("has the right header html for the without_workspace style", function() {
                this.presenter.options.displayStyle = ["without_workspace"];
                this.activity_without_workspace_data["countExcludingNamed"] = this.model.get("numAdded") - 1;
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.MembersAdded.many.without_workspace",
                        this.activity_without_workspace_data
                );
            });
        });
    });

    context("user added event", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.userCreated();
            this.actor = this.model.actor();
            this.newUser = this.model.newUser();
            this.presenter = new chorus.presenters.Activity(this.model);

            this.activity_data = {
                newUserLink: linkTo(this.newUser.showUrl(), this.newUser.name())
            };
        });

        itHasTheActorIcon();

        it("has the right header html for the default style", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.UserAdded.default",
                this.activity_data
            );
        });

        it("has the right header html for the without_workspace style", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.UserAdded.without_workspace",
                this.activity_data
            );
        });

        context("for notifications", function() {
            beforeEach(function() {
                this.presenter =new chorus.presenters.Activity(this.model, {isNotification: true});
            });

            it("has the right header html for the default style", function() {
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.UserAdded.notification.default",
                    this.activity_data
                );
            });

            it("has the right header html for the without_workspace style", function() {
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.UserAdded.notification.without_workspace",
                    this.activity_data
                );
            });
        });
    });

    context("file import created event", function() {
        beforeEach(function () {
            this.model = backboneFixtures.activity.fileImportCreated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();

            this.activity_data = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                importType: this.model.get("importType"),
                importSourceLink: this.model.get("fileName"),
                datasetType: t("dataset.entitySubtypes.table"),
                destObjectOrName: "table"
            };
        });
        context("when called with a FILE_IMPORT_CREATED event", function () {
            it("blank out the without_workspace style and use default instead", function () {
                this.presenter.options.displayStyle = ["without_workspace"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.FileImportCreated.default",
                    this.activity_data
                );
            });
            context("when importing to a new table", function () {
                it("displays the destination table name without link", function () {
                    expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                        "activity.header.FileImportCreated.default",
                        this.activity_data
                    );
                });
            });
            context("when importing to an existing table", function () {
                beforeEach(function () {
                    this.datasetModel = backboneFixtures.dataset();
                    this.model = backboneFixtures.activity.fileImportCreated({dataset: this.datasetModel});
                    this.dataset = this.model.dataset();
                    this.activity_data["destObjectOrName"] = linkTo(this.dataset.showUrl(), this.dataset.name());
                    this.presenter = new chorus.presenters.Activity(this.model);
                });
                it("displays the destination table name with dataset link", function () {
                    expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                        "activity.header.FileImportCreated.default",
                        this.activity_data
                    );
                });
            });
        });
    });

    context("gnip import created event", function() {
        context("when dataset does not yet exist", function() {
            beforeEach(function () {
                this.model = backboneFixtures.activity.gnipStreamImportCreated();
                this.dataset = backboneFixtures.dataset();
                this.presenter = new chorus.presenters.Activity(this.model);
                this.actor = this.model.actor();
                this.gnipDataSource = this.model.gnipDataSource();

                this.activity_data = {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    gnipDataSourceLink: linkTo(this.gnipDataSource.showUrl(), this.gnipDataSource.name()),
                    destObjectOrName: this.model.get('destinationTable')
                };
            });

            it("has the right header html", function() {
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.GnipStreamImportCreated.default",
                    this.activity_data
                );
            });
        });

        context("when dataset exists", function() {
            beforeEach(function () {
                this.model = backboneFixtures.activity.gnipStreamImportCreated();
                this.dataset = backboneFixtures.dataset();
                this.dataset.set({ workspace: this.model.get('workspace') });
                var workspaceDataset = new chorus.models.WorkspaceDataset(this.dataset);
                this.model.set({ dataset: this.dataset });

                this.presenter = new chorus.presenters.Activity(this.model);
                this.actor = this.model.actor();
                this.gnipDataSource = this.model.gnipDataSource();

                this.activity_data = {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    destObjectOrName: linkTo(workspaceDataset.showUrl(), workspaceDataset.name()),
                    gnipDataSourceLink: linkTo(this.gnipDataSource.showUrl(), this.gnipDataSource.name())
                };
            });

            it("has the right header html", function() {
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.GnipStreamImportCreated.default",
                    this.activity_data
                );
            });
        });
    });

    context("gnip import success event", function() {
        beforeEach(function () {
            this.model = backboneFixtures.activity.gnipStreamImportSuccess();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.workspace = this.model.workspace();
            this.dataset = this.model.dataset();
            this.gnipDataSource = this.model.gnipDataSource();

            this.activity_data = {
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                gnipDataSourceLink: linkTo(this.gnipDataSource.showUrl(), this.gnipDataSource.name())
            };
        });

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.GnipStreamImportSuccess.default",
                this.activity_data
            );
        });
    });

    context("gnip import failure event", function() {
        beforeEach(function () {
            this.model = backboneFixtures.activity.gnipStreamImportFailed();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.workspace = this.model.workspace();
            this.gnipDataSource = this.model.gnipDataSource();

            this.activity_data = {
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                gnipDataSourceLink: linkTo(this.gnipDataSource.showUrl(), this.gnipDataSource.name()),
                destinationTable: this.model.get('destinationTable')
            };
        });

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.GnipStreamImportFailed.default",
                this.activity_data
            );
            expect(this.presenter.isFailure()).toBe(true);
        });
    });

    context("workspace import created event", function() {
        beforeEach(function () {
            this.datasetModel = backboneFixtures.dataset();
            this.model = backboneFixtures.activity.workspaceImportCreated({dataset: this.datasetModel});
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.dataset = this.model.dataset();
            this.sourceDataset = this.model.importSource();

            this.activity_data = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                importSourceDatasetLink: linkTo(this.sourceDataset.showUrl(), this.sourceDataset.name()),
                datasetType: t("dataset.entitySubtypes.table"),
                destObjectOrName: linkTo(this.dataset.showUrl(), this.dataset.name())
            };
        });
        context("when called with a DATASET_IMPORT_CREATED event", function () {
            it("blank out the without_workspace style and use default instead", function () {
                this.presenter.options.displayStyle = ["without_workspace"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.WorkspaceImportCreated.default",
                    this.activity_data
                );
            });
            context("when importing to a new table", function () {
                beforeEach(function() {
                    this.datasetModel = backboneFixtures.dataset();
                    this.model = backboneFixtures.activity.workspaceImportCreated();
                    this.dataset = this.model.dataset();
                    this.presenter = new chorus.presenters.Activity(this.model);
                    this.activity_data["destObjectOrName"] =  "other_table";
                });
                it("displays the destination table name without link", function () {
                    backboneFixtures.activity.workspaceImportCreated();
                    expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                        "activity.header.WorkspaceImportCreated.default",
                        this.activity_data
                    );
                });
            });
            context("when importing to an existing table", function () {
                beforeEach(function () {
                    this.datasetModel = backboneFixtures.dataset();
                    this.model = backboneFixtures.activity.workspaceImportCreated({dataset: this.datasetModel});
                    this.dataset = this.model.dataset();
                    this.presenter = new chorus.presenters.Activity(this.model);
                });
                it("displays the destination table name with dataset link", function () {
                    expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                        "activity.header.WorkspaceImportCreated.default", {
                            actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                            importSourceDatasetLink: linkTo(this.sourceDataset.showUrl(), this.sourceDataset.name()),
                            datasetType: t("dataset.entitySubtypes.table"),
                            destObjectOrName: linkTo(this.dataset.showUrl(), this.dataset.name()),
                            workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                        }
                    );
                });
            });
        });
    });

    context("import schedule updated event", function() {
        beforeEach(function () {
            this.datasetModel = backboneFixtures.dataset();
            this.model = backboneFixtures.activity.importScheduleUpdated({dataset: this.datasetModel});
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.dataset = this.model.dataset();
            this.sourceDataset = this.model.importSource();

            this.activity_data = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                importSourceDatasetLink: linkTo(this.sourceDataset.showUrl(), this.sourceDataset.name()),
                datasetType: t("dataset.entitySubtypes.table"),
                destObjectOrName: linkTo(this.dataset.showUrl(), this.dataset.name())
            };
        });
        context("when called with a IMPORT SCHEDULE UPDATED event", function () {
            it("uses the without_workspace style ", function () {
                this.presenter.options.displayStyle = ["without_workspace"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.ImportScheduleUpdated.without_workspace",
                    this.activity_data
                );
            });
            context("when importing to a new table", function () {
                beforeEach(function() {
                    this.datasetModel = backboneFixtures.dataset();
                    this.model = backboneFixtures.activity.importScheduleUpdated();
                    this.dataset = this.model.dataset();
                    this.presenter = new chorus.presenters.Activity(this.model);
                    this.activity_data["destObjectOrName"] =  "other_table";
                });
                it("displays the destination table name without link", function () {
                    expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                        "activity.header.ImportScheduleUpdated.default",
                        this.activity_data
                    );
                });
            });
            context("when importing to an existing table", function () {
                beforeEach(function () {
                    this.datasetModel = backboneFixtures.dataset();
                    this.model = backboneFixtures.activity.importScheduleUpdated({dataset: this.datasetModel});
                    this.dataset = this.model.dataset();
                    this.presenter = new chorus.presenters.Activity(this.model);
                });
                it("displays the destination table name with dataset link", function () {
                    expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                        "activity.header.ImportScheduleUpdated.default", {
                            actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                            importSourceDatasetLink: linkTo(this.sourceDataset.showUrl(), this.sourceDataset.name()),
                            datasetType: t("dataset.entitySubtypes.table"),
                            destObjectOrName: linkTo(this.dataset.showUrl(), this.dataset.name()),
                            workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                        }
                    );
                });
            });
        });
    });

    context("import schedule deleted event", function() {
        beforeEach(function () {
            this.datasetModel = backboneFixtures.dataset();
            this.model = backboneFixtures.activity.importScheduleDeleted({dataset: this.datasetModel});
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.dataset = this.model.dataset();
            this.sourceDataset = this.model.importSource();

            this.activity_data = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                importSourceDatasetLink: linkTo(this.sourceDataset.showUrl(), this.sourceDataset.name()),
                datasetType: t("dataset.entitySubtypes.table"),
                destObjectOrName: linkTo(this.dataset.showUrl(), this.dataset.name())
            };
        });
        context("when called with a IMPORT SCHEDULE DELETED event", function () {
            it("uses the without_workspace style ", function () {
                this.presenter.options.displayStyle = ["without_workspace"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.ImportScheduleDeleted.without_workspace",
                    this.activity_data
                );
            });
            context("when importing to a new table", function () {
                beforeEach(function() {
                    this.datasetModel = backboneFixtures.dataset();
                    this.model = backboneFixtures.activity.importScheduleDeleted();
                    this.dataset = this.model.dataset();
                    this.presenter = new chorus.presenters.Activity(this.model);
                    this.activity_data["destObjectOrName"] =  "other_table_deleted";
                });
                it("displays the destination table name without link", function () {
                    expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                        "activity.header.ImportScheduleDeleted.default",
                        this.activity_data
                    );
                });
            });
            context("when importing to an existing table", function () {
                beforeEach(function () {
                    this.datasetModel = backboneFixtures.dataset();
                    this.model = backboneFixtures.activity.importScheduleDeleted({dataset: this.datasetModel});
                    this.dataset = this.model.dataset();
                    this.presenter = new chorus.presenters.Activity(this.model);
                });
                it("displays the destination table name with dataset link", function () {
                    expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                        "activity.header.ImportScheduleDeleted.default", {
                            actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                            importSourceDatasetLink: linkTo(this.sourceDataset.showUrl(), this.sourceDataset.name()),
                            datasetType: t("dataset.entitySubtypes.table"),
                            destObjectOrName: linkTo(this.dataset.showUrl(), this.dataset.name()),
                            workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                        }
                    );
                });
            });
        });
    });

    context("chorus view created event", function() {
        context("from dataset", function() {
            beforeEach(function() {
                this.model = backboneFixtures.activity.chorusViewCreatedFromDataset();
                this.presenter = new chorus.presenters.Activity(this.model);
                this.actor = this.model.actor();
                this.workspace = this.model.workspace();
                this.dataset = this.model.dataset();
                var sourceObject = new chorus.models.WorkspaceDataset(this.model.get('sourceObject'));
                sourceObject.set({workspace: this.workspace});
                this.model.set({sourceObject: sourceObject});

                this.translation_params = {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    chorusViewSourceLink: linkTo(sourceObject.showUrl(), sourceObject.name()),
                    chorusViewSourceType: t("dataset.entitySubtypes.table"),
                    datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                };
            });

            context("without workspace", function() {
                it("has the right header html", function() {
                    this.presenter.options.displayStyle = ["without_workspace"];
                    expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                        "activity.header.ChorusViewCreated.without_workspace", this.translation_params
                    );
                });
            });

            context("with workspace", function() {
                it("has the right header html", function() {
                    this.presenter.options.displayStyle = ["default"];
                    expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                        "activity.header.ChorusViewCreated.default", this.translation_params
                    );
                });
            });

            itHasTheActorIcon();
        });

        context("from duplication of a ChorusView", function() {
            beforeEach(function() {
                this.model = backboneFixtures.activity.chorusViewCreatedFromDataset();
                this.presenter = new chorus.presenters.Activity(this.model);
                this.actor = this.model.actor();
                this.workspace = this.model.workspace();
                this.dataset = this.model.dataset();
                var sourceObject = new chorus.models.WorkspaceDataset(this.model.get('sourceObject'));
                sourceObject.set({objectType: "CHORUS_VIEW"});
                sourceObject.set({workspace: this.workspace});
                this.model.set({sourceObject: sourceObject});

                this.translation_params = {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    chorusViewSourceLink: linkTo(sourceObject.showUrl(), sourceObject.name()),
                    chorusViewSourceType: t("dataset.entitySubtypes.query"),
                    datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                };
            });

            context("without workspace", function() {
                it("has the right header html", function() {
                    this.presenter.options.displayStyle = ["without_workspace"];
                    expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                        "activity.header.ChorusViewCreated.without_workspace", this.translation_params
                    );
                });
            });

            context("with workspace", function() {
                it("has the right header html", function() {
                    this.presenter.options.displayStyle = ["default"];
                    expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                        "activity.header.ChorusViewCreated.default", this.translation_params
                    );
                });
            });

            itHasTheActorIcon();
        });

        context("from workfile", function() {
            beforeEach(function() {
                this.model = backboneFixtures.activity.chorusViewCreatedFromWorkfile();
                this.presenter = new chorus.presenters.Activity(this.model);
                this.actor = this.model.actor();
                this.workspace = this.model.workspace();
                this.dataset = this.model.dataset();
                var sourceObject = new chorus.models.Workfile(this.model.get('sourceObject'));
                this.translation_params = {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    chorusViewSourceLink: linkTo(sourceObject.showUrl(), sourceObject.name()),
                    chorusViewSourceType: 'workfile',
                    datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                };
            });

            context("without workspace", function() {
                it("has the right header html", function() {
                    this.presenter.options.displayStyle = ["without_workspace"];
                    expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                        "activity.header.ChorusViewCreated.without_workspace", this.translation_params
                    );
                });
            });

            context("with workspace", function() {
                it("has the right header html", function() {
                    this.presenter.options.displayStyle = ["default"];
                    expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                        "activity.header.ChorusViewCreated.default", this.translation_params
                    );
                });
            });

            itHasTheActorIcon();
        });
    });

    context("hdfs dataset created event", function () {
        beforeEach(function () {
            this.model = backboneFixtures.activity.hdfsDatasetCreated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.dataset = this.model.dataset();

            this.translation_params = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                hdfsDatasetType: t("dataset.entitySubtypes.mask"),
                datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
            };
        });

        it("has the right header html", function () {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.HdfsDatasetCreated.default", this.translation_params
            );
        });
    });

    context("hdfs dataset updated event", function () {
        beforeEach(function () {
            this.model = backboneFixtures.activity.hdfsDatasetUpdated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.dataset = this.model.dataset();

            this.translation_params = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                hdfsDatasetType: t("dataset.entitySubtypes.mask"),
                datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
            };
        });

        it("has the right header html", function () {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.HdfsDatasetUpdated.default", this.translation_params
            );
        });
    });

    context("job succeeded event", function () {
        beforeEach(function () {
            this.model = backboneFixtures.activity.jobSucceeded();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.job = this.model.job();

            this.translation_params = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                jobLink: linkTo(this.job.showUrl(), this.job.name()),
                jobResultDialog: linkTo('#', t('job.show_details.link'), {'class': 'JobResult'})
            };
        });

        it("has the right header html", function () {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.JobSucceeded.default", this.translation_params
            );
        });
    });

    context("job failed event", function () {
        beforeEach(function () {
            this.model = backboneFixtures.activity.jobFailed();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.job = this.model.job();

            this.translation_params = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                jobLink: linkTo(this.job.showUrl(), this.job.name()),
                jobResultDialog: linkTo('#', t('job.show_details.link'), {'class': 'JobResult'})
            };
        });

        it("has the right header html", function () {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.JobFailed.default", this.translation_params
            );
        });
    });

    context("job disabled event", function () {
        beforeEach(function () {
            this.model = backboneFixtures.activity.jobDisabled();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.job = this.model.job();

            this.translation_params = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                jobLink: linkTo(this.job.showUrl(), this.job.name())
            };
        });

        it("has the right header html", function () {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.JobDisabled.default", this.translation_params
            );
        });
    });

    context("job created event", function () {
        beforeEach(function () {
            this.model = backboneFixtures.activity.jobCreated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.job = this.model.job();

            this.translation_params = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                jobLink: linkTo(this.job.showUrl(), this.job.name())
            };
        });

        context("without workspace", function() {
            it("has the right header html", function() {
                this.presenter.options.displayStyle = ["without_workspace"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.JobCreated.without_workspace", this.translation_params
                );
            });
        });

        context("with workspace", function() {
            it("has the right header html", function() {
                this.presenter.options.displayStyle = ["default"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.JobCreated.default", this.translation_params
                );
            });
        });


    });

    context("job deleted event", function () {
        beforeEach(function () {
            this.model = backboneFixtures.activity.jobDeleted();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.job = this.model.job();

            this.translation_params = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                jobLink: linkTo(this.job.showUrl(), this.job.name())
            };
        });

        context("without workspace", function() {
            it("has the right header html", function() {
                this.presenter.options.displayStyle = ["without_workspace"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.JobCreated.without_workspace", this.translation_params
                );
            });
        });

        context("with workspace", function() {
            it("has the right header html", function() {
                this.presenter.options.displayStyle = ["default"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.JobCreated.default", this.translation_params
                );
            });
        });

    });

    context("dataset changed query event", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.chorusViewChanged();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.dataset = this.model.dataset();

            this.translation_params = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
            };
        });

        context("without workspace", function() {
            it("has the right header html", function() {
                this.presenter.options.displayStyle = ["without_workspace"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.ChorusViewChanged.without_workspace", this.translation_params
                );
            });
        });

        context("with workspace", function() {
            it("has the right header html", function() {
                this.presenter.options.displayStyle = ["default"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.ChorusViewChanged.default", this.translation_params
                );
            });
        });

        itHasTheActorIcon();
    });

    context("database view created from chorus view", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.viewCreated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.dataset = this.model.dataset();
            var chorusView = this.model.importSource(); // importSource association in activity.js is same as this.sourceDataset

            this.translation_params = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                chorusViewLink: linkTo(chorusView.showUrl(), chorusView.name())
            };
        });

        context("without workspace", function() {
            it("has the right header html", function() {
                this.presenter.options.displayStyle = ["without_workspace"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.ViewCreated.without_workspace", this.translation_params
                );
            });
        });

        context("with workspace", function() {
            it("has the right header html", function() {
                this.presenter.options.displayStyle = ["default"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.ViewCreated.default", this.translation_params
                );
            });
        });

        itHasTheActorIcon();
    });

    context("tableau workbook published", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.tableauWorkbookPublished({
                workspace: {id: 55, name: "paleo_eaters"},
                workbookName: "fancy_workbook",
                workbookUrl: "http://example.com/workbooks/fancy_workbook",
                projectName: "default",
                projectUrl: "http://defaultproject.com"
            });
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.dataset = this.model.dataset();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.TableauWorkbookPublished.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                    datasetType: t("dataset.entitySubtypes.query"),
                    tableauWorkbookLink: "<a href='http://example.com/workbooks/fancy_workbook' target='_blank'>fancy_workbook</a>",
                    tableauProjectLink: "<a href='http://defaultproject.com' target='_blank'>default</a>"
                }
            );
        });
    });

    context("tableau workbook published", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.tableauWorkfileCreated({
                workspace: {id: 55, name: "paleo_eaters"},
                workbookName: "fancy_workbook"
            });
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.dataset = this.model.dataset();
            this.workfile = this.model.workfile();
        });

        itHasTheActorIcon();

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.TableauWorkfileCreated.default", {
                    actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                    datasetLink: linkTo(this.dataset.showUrl(), this.dataset.name()),
                    datasetType: t("dataset.entitySubtypes.query"),
                    workfileLink: linkTo(this.workfile.showUrl(), this.workfile.name()),
                    workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name())
                }
            );
        });
    });

    context("credentials invalid", function() {
        beforeEach(function() {
            this.model = backboneFixtures.activity.credentialsInvalid();
            this.presenter = new chorus.presenters.Activity(this.model, {isNotification: true});
            this.actor = this.model.actor();
            this.dataSource = this.model.dataSource();
        });

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.CredentialsInvalid.notification.default", {
                    dataSourceLink: linkTo(this.dataSource.showUrl(), this.dataSource.name()),
                    updateCredentialsLink: linkTo('#', t('dataset.credentials.missing.linkText'), {'class': 'update_credentials'})
                }
            );
        });
    });

    context("workfile results", function () {
        beforeEach(function() {
            this.model = backboneFixtures.activity.workfileResult();
            this.model.set({
                attachments: [
                    { entityType: "work_flow_result", id: "0.12345"}
                ]
            });
            this.presenter = new chorus.presenters.Activity(this.model, {});
            this.actor = this.model.actor();
        });

        it("has the right header html", function() {
            expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                "activity.header.WorkfileResult.default", {
                    workfileLink: linkTo(this.model.workfile().showUrl(), this.model.workfile().name())
                }
            );
        });
    });

    context("milestone created event", function () {
        beforeEach(function () {
            this.model = backboneFixtures.activity.milestoneCreated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.milestone = this.model.milestone();

            this.translation_params = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                milestoneLink:  linkTo(this.milestone.showUrl(), this.milestone.name())
            };
        });

        context("without workspace", function() {
            it("has the right header html", function() {
                this.presenter.options.displayStyle = ["without_workspace"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.MilestoneCreated.without_workspace", this.translation_paramsms
                );
            });
        });

        context("with workspace", function() {
            it("has the right header html", function() {
                this.presenter.options.displayStyle = ["default"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.MilestoneCreated.default", this.translation_params
                );
            });
        });

    });

    context("milestone updated event", function () {
        beforeEach(function () {
            this.model = backboneFixtures.activity.milestoneUpdated();
            this.presenter = new chorus.presenters.Activity(this.model);
            this.actor = this.model.actor();
            this.workspace = this.model.workspace();
            this.milestone = this.model.milestone();
            milestoneState =  "milestone.state." + this.milestone.get("state").toString;
            console.log(this.milestone.attributes.state);
            console.log(milestoneState);

            this.translation_params = {
                actorLink: linkTo(this.actor.showUrl(), this.actor.name()),
                workspaceLink: linkTo(this.workspace.showUrl(), this.workspace.name()),
                milestoneLink:  linkTo(this.milestone.showUrl(), this.milestone.name()),
                milestoneState:  milestoneState
            };
        });

        context("without workspace", function() {
            it("has the right header html", function() {
                this.presenter.options.displayStyle = ["without_workspace"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.MilestoneUpdated.without_workspace", this.translation_paramsms
                );
            });
        });

        context("with workspace", function() {
            it("has the right header html", function() {
                this.presenter.options.displayStyle = ["default"];
                expect(this.presenter.headerHtml().toString()).toMatchTranslation(
                    "activity.header.MilestoneUpdated.default", this.translation_params
                );
            });
        });

    });

});
