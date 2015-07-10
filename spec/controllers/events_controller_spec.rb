require "spec_helper"

describe EventsController do
  let(:current_user) { users(:the_collaborator) }
  let(:eager_loading_checker) do
    Proc.new do |model|
      model.association(:workspace).should be_loaded
      model.association(:datasets).should be_loaded
      model.association(:actor).should be_loaded
      model.association(:target1).should be_loaded
      model.association(:target2).should be_loaded

      model.association(:attachments).should be_loaded
      model.attachments.each { |attachment| attachment.association(:note).should be_loaded }

      model.association(:workfiles).should be_loaded
      model.workfiles.each { |workfile| workfile.association(:latest_workfile_version).should be_loaded }
      model.workfiles.each { |workfile| workfile.latest_workfile_version.association(:workfile).should be_loaded }

      model.association(:comments).should be_loaded
      model.comments.each { |comment| comment.association(:author).should be_loaded }
    end
  end

  before do
    log_in current_user
  end

  describe "#index" do
   it "returns the events with the newest one first" do
     mock_present { |models| models.first.id.should > models.second.id }
     get :index, :entity_type => "dashboard"
     response.code.should == "200"
   end

   it "eager loads the associations" do
     mock_present do |models|
       models.each {|m| eager_loading_checker.call m }
     end

     get :index, :entity_type => "dashboard"
   end

   it "passes the succinct option to the Presenter" do
     mock_present { |models, view, options| options[:succinct].should be_true }
     get :index, :entity_type => "dashboard"
   end

   context "getting activities for a particular model" do
      let(:event) { Events::Base.last }
      before do
        Activity.create!(:entity => object, :event => event)
      end

      context 'eager loading' do
        context 'for a user' do
          let(:object) { users(:owner) }

          it 'eager loads the associations' do
            any_instance_of(User) { |u| mock.proxy(u).accessible_events(current_user) }
            mock_present { |models| models.each {|m| eager_loading_checker.call m } }
            get :index, :entity_type => 'user', :entity_id => object.id
          end
        end

        context 'for a workfile' do
          let(:object) { workfiles(:private) }

          it 'eager loads the associations' do
            log_in(users(:owner))
            mock_present { |models| models.each {|m| eager_loading_checker.call m } }
            get :index, :entity_type => 'workfile', :entity_id => object.id
          end
        end
      end

      context "for a gpdb data source" do
        let(:object) { data_sources(:default) }

        it "presents the gpdb data source's activities" do
          mock_present { |models| models.should include(event) }
          get :index, :entity_type => "gpdb_data_source", :entity_id => object.id
          response.code.should == "200"
        end
      end

      context 'for a pg data source' do
        let(:object) { data_sources(:postgres) }

        it "presents the pg data source's activities" do
          mock_present { |models| models.should include(event) }
          get :index, :entity_type => 'pg_data_source', :entity_id => object.id
          response.code.should == '200'
        end
      end

      context "for an hdfs data source" do
        let(:object) { hdfs_data_sources(:hadoop) }

        it "presents the hdfs data source's activities" do
          mock_present { |models| models.should include(event) }
          get :index, :entity_type => "hdfs_data_source", :entity_id => object.id
          response.code.should == "200"
        end
      end

      context "for a user" do
        let(:object) { users(:owner) }

        it "presents the user's activities" do
          any_instance_of(User) { |u| mock.proxy(u).accessible_events(current_user) }
          mock_present { |models| models.should include(event) }
          get :index, :entity_type => "user", :entity_id => object.id
          response.code.should == "200"
        end
      end

      context "for a workfile" do
        let(:object) { workfiles(:private) }

        it "presents the workfile's activities" do
          log_in(users(:owner))
          mock_present { |models| models.should include(event) }
          get :index, :entity_type => "workfile", :entity_id => object.id
          response.code.should == "200"
        end

        context "when you are not authorized to see a workfile" do
          it "returns forbidden" do
            log_in(users(:default))
            get :index, :entity_type => "workfile", :entity_id => object.id

            response.should be_forbidden
          end
        end
      end

      context "for a linked tableau workfile" do
        let(:object) { workfiles(:private_tableau) }

        it "presents the tableau workfile's activities" do
          log_in(users(:owner))
          mock_present { |models| models.should include(event) }
          get :index, :entity_type => "workfile", :entity_id => object.id
          response.code.should == "200"
        end

        context "when you are not authorized to see a tableau workfile" do
          it "returns forbidden" do
            log_in(users(:default))
            get :index, :entity_type => "workfile", :entity_id => object.id

            response.should be_forbidden
          end
        end
      end

      context "for a chorus view" do
        let(:object) { datasets(:private_chorus_view) }

        it "presents the chorus_view's activities" do
          log_in(users(:owner))
          mock_present { |models| models.should include(event) }
          get :index, :entity_type => "dataset", :entity_id => object.id
          response.code.should == "200"
        end

        context "when you are not authorized to see a chorus_view" do
          it "returns forbidden" do
            log_in(users(:default))
            get :index, :entity_type => "dataset", :entity_id => object.id

            response.should be_forbidden
          end
        end
      end

      context "for a GPDB view" do
        let(:object) { datasets(:view) }

        it "presents the GPDB view's activities" do
          log_in(users(:owner))
          mock_present { |models| models.should include(event) }
          get :index, :entity_type => "dataset", :entity_id => object.id
          response.code.should == "200"
        end
      end

      context "for a workspace" do
        let(:object) { workspaces(:private) }

        it "presents the workspace's activities" do
          log_in(users(:owner))
          mock_present { |models| models.should include(event) }
          get :index, :entity_type => "workspace", :entity_id => object.id
          response.code.should == "200"
        end

        context "when you are not authorized to see a workspace" do
          it "returns forbidden" do
            log_in(users(:default))
            get :index, :entity_type => "workspace", :entity_id => object.id

            response.should be_forbidden
          end
        end
      end

      context "for a gpdb_table" do
        let(:object) { datasets(:default_table) }

        it "presents the gpdb_table's activities" do
          log_in(users(:owner))
          mock_present { |models| models.should include(event) }
          get :index, :entity_type => "dataset", :entity_id => object.id

          response.code.should == "200"
        end
      end

      context 'for a pg_table' do
        let(:object) { datasets(:pg_table) }

        it 'presents the activities' do
          log_in(users(:owner))
          mock_present { |models| models.should include(event) }
          get :index, :entity_type => 'dataset', :entity_id => object.id

          response.code.should == '200'
        end
      end

      context 'for a pg_view' do
        let(:object) { datasets(:pg_view) }

        it 'presents the activities' do
          log_in(users(:owner))
          mock_present { |models| models.should include(event) }
          get :index, :entity_type => 'dataset', :entity_id => object.id

          response.code.should == '200'
        end
      end

      context "for a HDFS Dataset" do
        let(:object) { datasets(:hadoop) }

        it "presents the hdfs dataset's activities" do
          mock_present { |models| models.should include(event) }

          get :index, :entity_type => "dataset", :entity_id => object.id
          response.code.should == "200"
        end
      end

      context "for an hdfs file" do
        let(:object) { HdfsEntry.last }

        it "presents the workspace's activities" do
          mock_present { |models| models.should include(event) }
          get :index, :entity_type => "hdfs_file", :entity_id => object.id
          response.code.should == "200"
        end
      end

      context "for the current user's home page" do
        let(:object) { datasets(:default_table) }

        before do
          mock(Events::Base).for_dashboard_of(current_user) { fake_relation [event] }
        end

        it "presents the user's activities" do
          mock_present do |models, view, options|
            models.should == [event]
            options[:activity_stream].should be_true
          end
          get :index, :entity_type => "dashboard"
          response.code.should == "200"
        end
      end
    end
  end

  describe "#show" do
    let(:event) { events(:note_on_no_collaborators_private) }

    it "shows the particular event " do
      mock_present do |model, view, options|
        model.should == event
        options[:activity_stream].should be_true
      end
      log_in users(:no_collaborators)
      get :show, :id => event.to_param
      response.code.should == "200"
    end

    it "returns an error when trying to show an activity for which the user doesn't have access" do
      log_in users(:owner)
      get :show, :id => event.to_param
      response.code.should == "404"
    end

    it "passes the succinct option to the Presenter" do
      mock_present { |models, view, options| options[:succinct].should be_true }
      get :show, :id => event.to_param
    end

    context "when the workspace is public" do
      let(:event) { events(:note_on_no_collaborators_public) }

      it "should show the event" do
        log_in users(:owner)
        get :show, :id => event.to_param
        response.code.should == "200"
      end
    end

    context "when the user is an admin and the workspace is private" do
      it "should show the event" do
        log_in users(:admin)
        get :show, :id => event.to_param
        response.code.should == "200"
      end
    end

    FIXTURE_FILES = {
        'dataSourceCreated' => Events::DataSourceCreated,
        'dataSourceDeleted' => Events::DataSourceDeleted,
        'gnipDataSourceCreated' => Events::GnipDataSourceCreated,
        'hdfsDataSourceCreated' => Events::HdfsDataSourceCreated,
        'dataSourceChangedOwner' => Events::DataSourceChangedOwner,
        'dataSourceChangedName' => Events::DataSourceChangedName,
        'hdfsDataSourceChangedName' => Events::HdfsDataSourceChangedName,
        'publicWorkspaceCreated' => Events::PublicWorkspaceCreated,
        'privateWorkspaceCreated' => Events::PrivateWorkspaceCreated,
        'workspaceMakePublic' => Events::WorkspaceMakePublic,
        'workspaceMakePrivate' => Events::WorkspaceMakePrivate,
        'workspaceArchived' => Events::WorkspaceArchived,
        'workspaceUnarchived' => Events::WorkspaceUnarchived,
        'workfileCreated' => Events::WorkfileCreated,
        'sourceTableCreated' => :source_table_created,
        'userCreated' => Events::UserAdded,
        'sandboxAdded' => Events::WorkspaceAddSandbox,
        'insightOnGreenplumDataSource' => :insight_on_greenplum,
        'noteOnGnipDataSourceCreated' => :note_on_gnip_data_source,
        'insightOnGnipDataSourceCreated' => :insight_on_gnip_data_source,
        'insightOnWorkspace' => :insight_on_workspace,
        'noteOnGreenplumDataSource' => :note_on_greenplum,
        'noteOnOracleDataSource' => :note_on_oracle,
        'noteOnHdfsDataSourceCreated' => Events::NoteOnHdfsDataSource,
        'noteOnHdfsFileCreated' => Events::NoteOnHdfsFile,
        'noteOnWorkspaceCreated' => Events::NoteOnWorkspace,
        'noteOnWorkfileCreated' => Events::NoteOnWorkfile,
        'noteOnDatasetCreated' => Events::NoteOnDataset,
        'noteOnWorkspaceDatasetCreated' => Events::NoteOnWorkspaceDataset,
        'membersAdded' => Events::MembersAdded,
        'fileImportCreated' => Events::FileImportCreated,
        'fileImportSuccess' => Events::FileImportSuccess,
        'fileImportFailed' => Events::FileImportFailed,
        'workspaceImportCreated' => Events::WorkspaceImportCreated,
        'workspaceImportSuccess' => Events::WorkspaceImportSuccess,
        'workspaceImportFailed' => Events::WorkspaceImportFailed,
        'workfileUpgradedVersion' => Events::WorkfileUpgradedVersion,
        'workFlowUpgradedVersion' => Events::WorkFlowUpgradedVersion,
        'workfileVersionDeleted' => Events::WorkfileVersionDeleted,
        'chorusViewCreatedFromWorkfile' => Events::ChorusViewCreated.from_workfile,
        'chorusViewCreatedFromDataset' => Events::ChorusViewCreated.from_dataset,
        'chorusViewChanged' => Events::ChorusViewChanged,
        'workspaceChangeName' => Events::WorkspaceChangeName,
        'projectStatusChanged' => Events::ProjectStatusChanged,
        'tableauWorkbookPublished' => Events::TableauWorkbookPublished,
        'tableauWorkfileCreated' => Events::TableauWorkfileCreated,
        'gnipStreamImportCreated' => Events::GnipStreamImportCreated,
        'gnipStreamImportSuccess' => Events::GnipStreamImportSuccess,
        'gnipStreamImportFailed' => Events::GnipStreamImportFailed,
        'viewCreated' => Events::ViewCreated,
        'importScheduleUpdated' => Events::ImportScheduleUpdated,
        'importScheduleDeleted' => Events::ImportScheduleDeleted,
        'workspaceDeleted' => Events::WorkspaceDeleted,
        'hdfsFileExtTableCreated' => Events::HdfsFileExtTableCreated,
        'hdfsDirectoryExtTableCreated' => Events::HdfsDirectoryExtTableCreated,
        'hdfsPatternExtTableCreated' => Events::HdfsPatternExtTableCreated,
        'hdfsDatasetExtTableCreated' => Events::HdfsDatasetExtTableCreated,
        'schemaImportCreated' => Events::SchemaImportCreated,
        'schemaImportSuccess' => Events::SchemaImportSuccess,
        'schemaImportFailed' => Events::SchemaImportFailed,
        'credentialsInvalid' => Events::CredentialsInvalid,
        'datasetImportFailedWithModelErrors' => :import_failed_with_model_errors,
        'hdfsDatasetCreated' => Events::HdfsDatasetCreated,
        'hdfsDatasetUpdated' => Events::HdfsDatasetUpdated,
        'jobSucceeded' => Events::JobSucceeded,
        'jobFailed' => Events::JobFailed,
        'workfileResult' => Events::WorkfileResult,
        'jobDisabled' => Events::JobDisabled,
        'jobCreated' => Events::JobCreated,
        'jobDeleted' => Events::JobDeleted,
        'hdfsImportSuccess' => Events::HdfsImportSuccess,
        'hdfsImportFailed' => Events::HdfsImportFailed,
        'milestoneCreated' => Events::MilestoneCreated,
        'milestoneUpdated' => Events::MilestoneUpdated
    }

    FIXTURE_FILES.each do |file_name, event_class|
      generate_fixture "activity/#{file_name}.json" do
        event = event_class.is_a?(Symbol) ? events(event_class) : event_class.last!
        Activity.global.create!(:event => event)
        get :show, :id => event.to_param
      end
    end
  end
end
