require_relative './database_integration/greenplum_integration'
require_relative './database_integration/hawq_integration'
require_relative './database_integration/oracle_integration'
require_relative './database_integration/jdbc_integration'
require_relative './database_integration/hdfs_integration'
require_relative './database_integration/postgres_integration'
require_relative './current_user'
require 'rr'

def FixtureBuilder.password
  'password'
end

FixtureBuilder.configure do |fbuilder|
  # rebuild fixtures automatically when these files change:
  fbuilder.files_to_check += Dir[*%w{
    spec/support/fixture_builder.rb
    spec/factories/*
    db/structure.sql
    spec/support/database_integration/*
    tmp/*_HOST_STALE
    spec/support/test_data_sources_config.yml
  }]

  fbuilder.name_model_with(ChorusWorkfile) do |record|
    record['file_name'].gsub(/\s+/, '_').downcase
  end
  fbuilder.name_model_with(User) do |record|
    record['username'].downcase
  end

  fbuilder.fixture_builder_file = Rails.root + "tmp/fixture_builder_#{GreenplumIntegration.hostname}_#{Rails.env}.yml"

  # now declare objects
  fbuilder.factory do
    extend CurrentUserHelpers
    extend RR::Adapters::RRMethods
    Sunspot.session = SunspotMatchers::SunspotSessionSpy.new(Sunspot.session)

    [Import].each do |type|
      any_instance_of(type) do |object|
        stub(object).table_exists? {}
        stub(object).tables_have_consistent_schema {}
      end
    end

    any_instance_of(DataSource) do |data_source|
      stub(data_source).valid_db_credentials? { true }
    end

    stub(License.instance).[](:vendor) { License::OPEN_CHORUS }

    (ActiveRecord::Base.direct_descendants).each do |klass|
      ActiveRecord::Base.connection.execute("ALTER SEQUENCE #{klass.table_name}_id_seq RESTART WITH 1000000;")
    end

    #Users
    admin = FactoryGirl.create(:admin, {:last_name => 'AlphaSearch', :username => 'admin'})
    evil_admin = FactoryGirl.create(:admin, {:last_name => 'AlphaSearch', :username => 'evil_admin'})
    Events::UserAdded.by(admin).add(:new_user => evil_admin)

    FactoryGirl.create(:user, :username => 'default')

    no_collaborators = FactoryGirl.create(:user, :username => 'no_collaborators')
    Events::UserAdded.by(admin).add(:new_user => no_collaborators)

    FactoryGirl.create(:user, :first_name => 'no_picture', :username => 'no_picture')
    with_picture = FactoryGirl.create(:user, :first_name => 'with_picture', :username => 'with_picture')
    with_picture.image = Rack::Test::UploadedFile.new(Rails.root.join('spec', 'fixtures', 'User.png'), "image/png")
    with_picture.save!

    owner = FactoryGirl.create(:user, :first_name => 'searchquery', :username => 'owner')
    owner.image = Rack::Test::UploadedFile.new(Rails.root.join('spec', 'fixtures', 'User.png'), "image/png")
    owner.save!

    @admin_creates_owner = Events::UserAdded.by(admin).add(:new_user => owner)

    the_collaborator = FactoryGirl.create(:user, :username => 'the_collaborator')
    Events::UserAdded.by(admin).add(:new_user => the_collaborator)

    not_a_member = FactoryGirl.create(:user, :username => 'not_a_member')
    Events::UserAdded.by(admin).add(:new_user => not_a_member)

    user_with_restricted_access = FactoryGirl.create(:user, :username => 'restricted_user')
    Events::UserAdded.by(user_with_restricted_access).add(:new_user => user_with_restricted_access)

    #Data Sources
    gpdb_data_source = FactoryGirl.create(:gpdb_data_source, :name => "searchquery", :description => "Just for searchquery and greenplumsearch", :host => "non.legit.example.com", :port => "5432", :db_name => "postgres", :owner => admin)
    fbuilder.name :default, gpdb_data_source
    Events::DataSourceCreated.by(admin).add(:data_source => gpdb_data_source)

    shared_data_source = FactoryGirl.create(:gpdb_data_source, :name => "Shared", :owner => admin, :shared => true)
    owners_data_source = FactoryGirl.create(:gpdb_data_source, :name => "Owners", :owner => owner, :shared => false)
    admin_only_data_source = FactoryGirl.create(:gpdb_data_source, :name => "Admins", :owner => admin, :shared => false)
    alternate_data_source = FactoryGirl.create(:gpdb_data_source, :name => "Alternate", :owner => admin, :shared => true)
    deleted_data_source = FactoryGirl.create(:gpdb_data_source, :name => "deleted", :owner => admin, :shared => true)
    with_current_user(owner) do
      deleted_data_source.destroy
    end

    FactoryGirl.create(:gpdb_data_source, :name => "Offline", :owner => owner, :state => "offline")
    FactoryGirl.create(:gpdb_data_source, :name => "Online", :owner => owner, :state => "online")

    @owner_creates_gpdb_data_source = Events::DataSourceCreated.by(owner).add(:data_source => owners_data_source)

    oracle_data_source = FactoryGirl.create(:oracle_data_source, name: 'oracle', owner: owner)
    fbuilder.name(:oracle, oracle_data_source)
    oracle_schema = FactoryGirl.create(:oracle_schema, name: 'oracle', data_source: oracle_data_source)
    fbuilder.name(:oracle, oracle_schema)
    @note_on_oracle = FactoryGirl.create(:note_on_data_source_event, :data_source => oracle_data_source, :body => 'note on oracle data source', actor: owner)

    FactoryGirl.create(:data_source_account, :owner => the_collaborator, :data_source => oracle_data_source)

    FactoryGirl.create(:oracle_schema, name: 'oracle_empty', data_source: oracle_data_source)
    oracle_table = FactoryGirl.create(:oracle_table, name: 'oracle_table', schema: oracle_schema)
    FactoryGirl.create(:oracle_table, name: 'other_oracle_table', schema: oracle_schema)
    FactoryGirl.create(:oracle_view, name: 'oracle_view', schema: oracle_schema)

    jdbc_data_source = FactoryGirl.create(:jdbc_data_source, :name => 'jdbc', :owner => owner)
    jdbc_schema = FactoryGirl.create(:jdbc_schema, :name => 'jdbc', :data_source => jdbc_data_source)
    FactoryGirl.create(:jdbc_schema, :name => 'jdbc_empty', :data_source => jdbc_data_source)
    jdbc_table = FactoryGirl.create(:jdbc_table, :name => 'jdbc_table', :schema => jdbc_schema)
    FactoryGirl.create(:jdbc_view, :name => 'jdbc_view', :schema => jdbc_schema)

    FactoryGirl.create(:jdbc_data_source, :name => 'searchquery_jdbc', :owner => owner, :description => 'searchquery for jdbc data source')
    FactoryGirl.create(:jdbc_data_source, :name => 'typeahead_jdbc_source', :owner => owner, :description => 'typeahead for jdbc data source')

    pg_data_source = FactoryGirl.create(:pg_data_source, :name => 'postgres', :owner => owner)
    pg_database = FactoryGirl.create(:pg_database, :name => 'pg', :data_source => pg_data_source)
    pg_schema = FactoryGirl.create(:pg_schema, :name => 'pg', :database => pg_database)
    FactoryGirl.create(:pg_schema, :name => 'pg_alternate', :database => pg_database)

    FactoryGirl.create(:pg_data_source, :name => 'typeahead_pg_source', :owner => owner, :description => 'typeahead for pg data source')
    FactoryGirl.create(:pg_data_source, :name => 'searchquery_pg', :owner => owner, :description => 'searchquery for pg data source')

    hdfs_data_source = HdfsDataSource.create!({:name => 'searchquery_hadoop', :description => 'searchquery for the hadoop data source', :host => 'hadoop.example.com', :port => '1111', :owner => admin, :hdfs_version => 'Pivotal HD 2'}, :without_protection => true)
    fbuilder.name :hadoop, hdfs_data_source
    Events::HdfsDataSourceCreated.by(admin).add(:hdfs_data_source => hdfs_data_source)

    fbuilder.name :searchable, HdfsEntry.create!({:path => "/searchquery/result.txt", :size => 10, :is_directory => false, :modified_at => "2010-10-20 22:00:00", :content_count => 4, :hdfs_data_source => hdfs_data_source}, :without_protection => true)
    fbuilder.name :searchable2, HdfsEntry.create!({:path => "/searchquery/other_result.txt", :size => 11, :is_directory => false, :modified_at => "2010-10-21 22:00:00", :content_count => 22, :hdfs_data_source => hdfs_data_source}, :without_protection => true)

    gnip_data_source = FactoryGirl.create(:gnip_data_source, :owner => owner, :name => "default", :description => "a searchquery example gnip account")
    FactoryGirl.create(:gnip_data_source, :owner => owner, :name => 'typeahead_gnip')
    Events::GnipDataSourceCreated.by(admin).add(:gnip_data_source => gnip_data_source)

    # Data Source Accounts
    @shared_data_source_account = shared_data_source.account_for_user(admin)
    @unauthorized = FactoryGirl.create(:data_source_account, :owner => the_collaborator, :data_source => owners_data_source)
    owner_data_source_account = owners_data_source.account_for_user(owner)


    # Datasets
    default_database = FactoryGirl.create(:gpdb_database, :data_source => owners_data_source, :name => 'default')
    default_schema = FactoryGirl.create(:gpdb_schema, :name => 'default', :database => default_database)
    FactoryGirl.create(:gpdb_schema, :name => "public", :database => default_database)
    default_table = FactoryGirl.create(:gpdb_table, :name => "default_table", :schema => default_schema)
    FactoryGirl.create(:gpdb_view, :name => "view", :schema => default_schema)

    other_schema = FactoryGirl.create(:gpdb_schema, :name => "other_schema", :database => default_database)
    other_table = FactoryGirl.create(:gpdb_table, :name => "other_table", :schema => other_schema)
    FactoryGirl.create(:gpdb_view, :name => "other_view", :schema => other_schema)

    source_table = FactoryGirl.create(:gpdb_table, :name => "source_table", :schema => other_schema)
    source_view = FactoryGirl.create(:gpdb_view, :name => "source_view", :schema => other_schema)

    tagged = FactoryGirl.create(:gpdb_table, :name => 'tagged', :schema => default_schema)
    tagged.tag_list = ['alpha']
    tagged.save!

    alternate_database = FactoryGirl.create(:gpdb_database, :data_source => alternate_data_source, :name => 'alternate')
    alternate_schema = FactoryGirl.create(:gpdb_schema, :name => 'alternate', :database => alternate_database)
    FactoryGirl.create(:gpdb_table, :name => "alternate", :schema => alternate_schema)

    FactoryGirl.create(:pg_table, :name => 'pg_table', :schema => pg_schema)
    FactoryGirl.create(:pg_table, :name => 'pg_table_alternate', :schema => pg_schema)
    FactoryGirl.create(:pg_view, :name => 'pg_view', :schema => pg_schema)

    # Search setup
    searchquery_database = FactoryGirl.create(:gpdb_database, :data_source => owners_data_source, :name => 'searchquery_database')
    searchquery_schema = FactoryGirl.create(:gpdb_schema, :name => "searchquery_schema", :database => searchquery_database)
    searchquery_table = FactoryGirl.create(:gpdb_table, :name => "searchquery_table", :schema => searchquery_schema)

    shared_search_database = FactoryGirl.create(:gpdb_database, :data_source => shared_data_source, :name => 'shared_database')
    shared_search_schema = FactoryGirl.create(:gpdb_schema, :name => 'shared_schema', :database => shared_search_database)
    FactoryGirl.create(:gpdb_table, :name => "searchquery_shared_table", :schema => shared_search_schema)

    # type ahead search fixtures
    FactoryGirl.create :workspace, :name => "typeahead_private", :public => false, :owner => owner
    typeahead_public_workspace = FactoryGirl.create :workspace, :name => "typeahead_public", :public => true, :owner => owner, :sandbox => searchquery_schema
    FactoryGirl.create :workspace, :name => "typeahead_private_no_members", :public => false, :owner => no_collaborators

    typeahead_with_dash = FactoryGirl.create(:gpdb_table, :name => "typeahead-with-dash", :schema => shared_search_schema)
    typeahead_with_underscore = FactoryGirl.create(:gpdb_table, :name => "typeahead_with_underscore", :schema => shared_search_schema)
    plurals = FactoryGirl.create(:gpdb_table, :name => "plurals", :schema => shared_search_schema)

    type_ahead_user = FactoryGirl.create :user, :first_name => 'typeahead', :username => 'typeahead'
    FactoryGirl.create :user, :first_name => 'typeahead_too', :username => 'typeahead_too' # the normal 'typeahead' user doesn't seem to be indexed or queryable. HERE BE DRAGONS

    FactoryGirl.create(:gpdb_table, :name => "typeahead_gpdb_table", :schema => searchquery_schema)
    @typeahead_chorus_view = FactoryGirl.create(:chorus_view, :name => "typeahead_chorus_view", :query => "select 1", :schema => searchquery_schema, :workspace => typeahead_public_workspace)
    typeahead_workfile = FactoryGirl.create(:chorus_workfile, :file_name => 'typeahead', :owner => owner, :workspace => typeahead_public_workspace)
    File.open(Rails.root.join('spec', 'fixtures', 'workfile.sql')) do |file|
      FactoryGirl.create(:workfile_version, :workfile => typeahead_workfile, :version_num => "1", :owner => owner, :modifier => owner, :contents => file)
    end

    typeahead_data_source = FactoryGirl.create(:gpdb_data_source, :name => 'typeahead_gpdb_data_source', :owner => owner)
    typeahead_hdfs_data_source = FactoryGirl.create(:hdfs_data_source, :name => 'typeahead_hdfs_data_source', :owner => owner)
    fbuilder.name :typeahead, typeahead_hdfs_data_source
    fbuilder.name :typeahead, FactoryGirl.create(:oracle_data_source, :name => 'typeahead_oracle_data_source', :owner => owner)

    fbuilder.name :typeahead, FactoryGirl.create(:hdfs_entry, :path => '/testdir/typeahead', :hdfs_data_source => typeahead_hdfs_data_source)
    fbuilder.name :typeahead, FactoryGirl.create(:workspace, :name => 'typeahead_workspace', owner: owner)

    with_current_user(owner) do
      note_on_greenplum_typeahead = Events::NoteOnDataSource.create!({:note_target => typeahead_data_source, :body => 'i exist only for my attachments'}, :as => :create)
      note_on_greenplum_typeahead.attachments.create!(:contents => File.new(Rails.root.join('spec', 'fixtures', 'typeahead_data_source')))
    end

    tagged_table = FactoryGirl.create(:gpdb_table, :name => "searchable_tag", :schema => searchquery_schema)
    tagged_table.tag_list = ["typeahead"]
    tagged_table.save!

    # Search Database Data Source Accounts For Solr Permissions
    searchquery_database.data_source_accounts << owner_data_source_account
    default_database.data_source_accounts << owner_data_source_account
    shared_search_database.data_source_accounts << @shared_data_source_account

    #Workspaces
    workspaces = []
    workspaces << @project = FactoryGirl.create(:project, :name => "Workspace that is an important project", :owner => owner)
    workspaces << no_collaborators_public_workspace = no_collaborators.owned_workspaces.create!(:name => "Public with no collaborators except collaborator", :summary => 'searchquery can see I guess', :public => true)
    @public_with_no_collaborators = no_collaborators_public_workspace
    workspaces << no_collaborators_private_workspace = no_collaborators.owned_workspaces.create!(:name => "Private with no collaborators", :summary => "Not for searchquery, ha ha", :public => false)
    workspaces << no_collaborators_archived_workspace = no_collaborators.owned_workspaces.create!({:name => "Archived", :sandbox => other_schema, :archived => true, :archived_at => '2010-01-01', :archiver => no_collaborators, :public => true}, :without_protection => true)
    workspaces << public_workspace = owner.owned_workspaces.create!({:name => "Public", :summary => "searchquery", :sandbox => default_schema, :public => true, :is_project => true}, :without_protection => true)
    workspaces << private_workspace = owner.owned_workspaces.create!(:name => "Private", :summary => "searchquery", :public => false)
    workspaces << search_public_workspace = owner.owned_workspaces.create!({:name => "Search Public", :summary => "searchquery", :sandbox => searchquery_schema, :public => true}, :without_protection => true)
    workspaces << search_private_workspace = owner.owned_workspaces.create!({:name => "Search Private", :summary => "searchquery", :sandbox => searchquery_schema, :public => false}, :without_protection => true)
    workspaces << owner.owned_workspaces.create!({:name => "no_sandbox", :summary => "No Sandbox", :public => false}, :without_protection => true)
    workspaces << @empty_workspace = owner.owned_workspaces.create!({:name => "empty", :public => true}, :without_protection => true)
    workspaces << owner.owned_workspaces.create!({:name => "tagged", :public => true, :sandbox => default_schema, :tag_list => ["alpha", "beta"]}, :without_protection => true)

    fbuilder.name :public, public_workspace
    fbuilder.name :private, private_workspace
    fbuilder.name :search_public, search_public_workspace
    fbuilder.name :search_private, search_private_workspace

    workspaces << image_workspace = admin.owned_workspaces.create!({:name => "image", :public => true}, :without_protection => true)
    image_workspace.image = Rack::Test::UploadedFile.new(Rails.root.join('spec', 'fixtures', 'Workspace.jpg'), "image/jpg")
    image_workspace.save!
    workspaces.each do |workspace|
      workspace.members << the_collaborator
    end

    # Workspace / Dataset associations
    public_workspace.source_datasets << source_table
    public_workspace.source_datasets << source_view

    @owner_creates_public_workspace = Events::PublicWorkspaceCreated.by(owner).add(:workspace => public_workspace, :actor => owner)
    @owner_creates_private_workspace = Events::PrivateWorkspaceCreated.by(owner).add(:workspace => private_workspace)

    Events::WorkspaceMakePublic.by(owner).add(:workspace => public_workspace)
    Events::WorkspaceMakePrivate.by(owner).add(:workspace => private_workspace)
    Events::WorkspaceDeleted.by(owner).add(:workspace => public_workspace)

    # HDFS Datasets need a workspace association
    attrs = FactoryGirl.attributes_for(:hdfs_dataset, :name => "hadoop", :hdfs_data_source => hdfs_data_source, :workspace => public_workspace)
    hadoop_dadoop = HdfsDataset.assemble!(attrs, hdfs_data_source, public_workspace)

    @searchquery_hadoop = HdfsDataset.assemble!(attrs.merge(:name => "searchquery_hadoop"), hdfs_data_source, search_public_workspace)

    Events::HdfsDatasetCreated.by(owner).add(:workspace => public_workspace, :dataset => hadoop_dadoop, :hdfs_data_source => hdfs_data_source)
    Events::HdfsDatasetUpdated.by(owner).add(:workspace => public_workspace, :dataset => hadoop_dadoop, :hdfs_data_source => hdfs_data_source)

    # Chorus View
    chorus_view = FactoryGirl.create(:chorus_view, :name => "chorus_view", :schema => default_schema, :query => "select * from a_table", :workspace => public_workspace)
    private_chorus_view = FactoryGirl.create(:chorus_view, :name => "private_chorus_view", :schema => default_schema, :query => "select * from a_table", :workspace => private_workspace)
    # Search Chorus Views
    search_chorus_view = FactoryGirl.create(:chorus_view, :name => "a_searchquery_chorus_view", :schema => searchquery_schema, :query => "select searchquery from a_table", :workspace => search_public_workspace)
    searchquery_chorus_view_private = FactoryGirl.create(:chorus_view, :name => "searchquery_chorus_view_private", :schema => searchquery_schema, :query => "select searchquery from a_table", :workspace => search_private_workspace)

    # Tableau publications
    publication = with_current_user(owner) do
      FactoryGirl.create :tableau_workbook_publication, :name => "default",
                                       :workspace => public_workspace, :dataset => chorus_view, :project_name => "Default"
    end

    tableau_workfile = LinkedTableauWorkfile.create({:file_name => 'tableau',
                                  :workspace => public_workspace,
                                  :owner => owner,
                                  :tableau_workbook_publication => publication
                                 }, :without_protection => true)

    LinkedTableauWorkfile.create({:file_name => 'searchquery',
                                  :workspace => public_workspace,
                                  :owner => owner,
                                  :tableau_workbook_publication => nil
                                 }, :without_protection => true)

    private_tableau_workfile = LinkedTableauWorkfile.create({:file_name => 'private_tableau',
                                                     :workspace => private_workspace,
                                                     :owner => owner,
                                                     :tableau_workbook_publication => nil
                                                    }, :without_protection => true)

    fbuilder.name :owner_creates_tableau_workfile, Events::TableauWorkfileCreated.by(owner).add(
        :workbook_name => publication.name,
        :dataset => publication.dataset,
        :workspace => publication.workspace,
        :workfile => tableau_workfile
    )

    #Alpine workfile

    work_flow = AlpineWorkfile.create!({:file_name => 'alpine_flow',
                                     :workspace => public_workspace,
                                     :owner => owner,
                                     :dataset_ids => %w(1 2 3),
                                    }, :without_protection => true)
    work_flow.workfile_execution_locations.create(execution_location: default_database)

    hadoop_work_flow = AlpineWorkfile.create!({:file_name => 'alpine_hadoop_dataset_flow',
                            :workspace => public_workspace,
                            :owner => owner,
                            :dataset_ids => HdfsDataset.limit(3).pluck(:id),
                           }, :without_protection => true)
    hadoop_work_flow.workfile_execution_locations.create!(execution_location: hdfs_data_source)

    oracle_work_flow = AlpineWorkfile.create!({:file_name => 'alpine_oracle_flow',
                                               :workspace => public_workspace,
                                               :owner => owner,
                                              }, :without_protection => true)
    oracle_work_flow.workfile_execution_locations.create!(execution_location: oracle_data_source)

    FactoryGirl.create(:work_flow_with_all_data_sources, :file_name => 'multiple_data_source_workflow', :workspace => public_workspace, :owner => owner)
    FactoryGirl.create(:work_flow, :file_name => 'multiple_dataset_workflow', :dataset_ids => [default_table.id, hadoop_dadoop.id, oracle_table.id, jdbc_table.id], :workspace => public_workspace, :owner => owner)

    Events::WorkfileResult.by(owner).add(:workfile => work_flow, :result_id => "1", :workspace => work_flow.workspace)

    #HDFS Entry
    @hdfs_file = FactoryGirl.create(:hdfs_entry, :path => '/foo/bar/baz.sql', :hdfs_data_source => hdfs_data_source)
    @directory = FactoryGirl.create(:hdfs_entry, :path => '/data', :hdfs_data_source => hdfs_data_source, :is_directory => true)

    #Workfiles
    File.open(Rails.root.join('spec', 'fixtures', 'workfile.sql')) do |file|
      no_collaborators_private = FactoryGirl.create(:chorus_workfile, :file_name => "no collaborators Private", :description => "searchquery", :owner => no_collaborators, :workspace => no_collaborators_private_workspace, :versions_attributes => [{:contents => file}])
      no_collaborators_workfile_version = no_collaborators_private.versions.first
      no_collaborators_public = FactoryGirl.create(:chorus_workfile, :file_name => "no collaborators Public", :description => "No Collaborators Search", :owner => no_collaborators, :workspace => no_collaborators_public_workspace, :versions_attributes => [{:contents => file}])
      private_workfile = FactoryGirl.create(:chorus_workfile, :file_name => "Private", :description => "searchquery", :owner => owner, :workspace => private_workspace, :execution_schema => default_schema, :versions_attributes => [{:contents => file}])

      public_workfile = FactoryGirl.create(:chorus_workfile, :file_name => "Public", :description => "searchquery", :owner => owner, :workspace => public_workspace, :versions_attributes => [{:contents => file}])
      fbuilder.name(:public, public_workfile.versions.first)

      private_search_workfile = FactoryGirl.create(:chorus_workfile, :file_name => "Search Private", :description => "searchquery", :owner => owner, :workspace => search_private_workspace, :execution_schema => searchquery_schema, :versions_attributes => [{:contents => file}])
      public_search_workfile = FactoryGirl.create(:chorus_workfile, :file_name => "Search Public", :description => "searchquery", :owner => owner, :workspace => search_public_workspace, :versions_attributes => [{:contents => file}])
      FactoryGirl.create(:workfile_version, :workfile => public_search_workfile, :version_num => "1", :owner => owner, :modifier => owner, :contents => file, :commit_message => "Committed to searchquery")

      tagged_workfile = FactoryGirl.create(:chorus_workfile, :file_name => 'tagged', :owner => owner, :workspace => public_workspace, :versions_attributes => [{:contents => file}])
      tagged_workfile.tag_list = ["alpha", "beta"]
      tagged_workfile.save!

      drafted_workfile = FactoryGirl.create(:chorus_workfile, :file_name => "DraftedWorkfile", :owner => owner, :workspace => public_workspace)
      @draft_default = FactoryGirl.create(:workfile_draft, :workfile => drafted_workfile, :owner => owner)
      FactoryGirl.create(:workfile_version, :workfile => drafted_workfile, :version_num => "1", :owner => owner, :modifier => owner, :contents => file)

      archived_workfile = FactoryGirl.create(:chorus_workfile, :file_name => "archived", :owner => no_collaborators, :workspace => no_collaborators_archived_workspace, :versions_attributes => [{:contents => file}])

      @sql_workfile = FactoryGirl.create(:chorus_workfile, :file_name => "sql.sql", :owner => owner, :workspace => public_workspace, :execution_schema => public_workspace.sandbox, :versions_attributes => [{:contents => file}])

      with_current_user(owner) do
        Events::NoteOnWorkfile.create!({:note_target => @sql_workfile, :body => 'note on workfile'}, :as => :create)
      end

      @no_collaborators_creates_private_workfile = Events::WorkfileCreated.by(no_collaborators).add(:workfile => no_collaborators_private, :workspace => no_collaborators_private_workspace, :commit_message => "Fix all the bugs!")
      @public_workfile_created = Events::WorkfileCreated.by(owner).add(:workfile => public_workfile, :workspace => public_workspace, :commit_message => "There be dragons!")
      @private_workfile_created = Events::WorkfileCreated.by(owner).add(:workfile => private_workfile, :workspace => private_workspace, :commit_message => "Chorus chorus chorus, i made you out of clay")
      Events::WorkfileCreated.by(no_collaborators).add(:workfile => no_collaborators_public, :workspace => no_collaborators_public_workspace, :commit_message => "Chorus chorus chorus, with chorus I will play")

      with_current_user(owner) do
        @note_on_public_workfile = Events::NoteOnWorkfile.create!({:note_target => public_workfile, :body => 'notesearch forever'}, :as => :create)
      end

      with_current_user(no_collaborators) do
        @note_on_no_collaborators_private_workfile = Events::NoteOnWorkfile.create!({:note_target => no_collaborators_private, :body => 'notesearch never'}, :as => :create)
      end
      Events::WorkfileUpgradedVersion.by(no_collaborators).add(:workspace => no_collaborators_private_workspace, :workfile => no_collaborators_private, :commit_message => 'commit message', :version_id => no_collaborators_workfile_version.id, :version_num => 1)
      Events::WorkFlowUpgradedVersion.by(no_collaborators).add(:workspace => no_collaborators_private_workspace, :workfile => no_collaborators_private, :commit_message => 'commit message')

      Events::WorkfileVersionDeleted.by(owner).add(:workspace => public_workspace, :workfile => public_workfile, :version_num => "15")

      Events::ChorusViewCreated.by(owner).add(:dataset => chorus_view, :workspace => public_workspace, :source_object => public_workfile)
      Events::ChorusViewChanged.by(owner).add(:dataset => chorus_view, :workspace => public_workspace)
      Events::ViewCreated.by(owner).add(:source_dataset => chorus_view, :workspace => public_workspace, :dataset => source_view)
    end

    File.open(Rails.root.join('spec', 'fixtures', 'non_utf8.sql')) do |file|
      FactoryGirl.create(:chorus_workfile, :file_name => 'non_utf8.sql', :owner => owner, :workspace => public_workspace, :execution_schema => public_workspace.sandbox, :versions_attributes => [{:contents => file}])
    end

    text_workfile = nil
    File.open Rails.root + 'spec/fixtures/some.txt' do |file|
      text_workfile = FactoryGirl.create(:chorus_workfile, :file_name => "text.txt", :owner => owner, :workspace => public_workspace, :versions_attributes => [{:contents => file}])
    end
    File.open Rails.root + 'spec/fixtures/small1.gif' do |file|
      FactoryGirl.create(:chorus_workfile, :file_name => "image.png", :owner => owner, :workspace => public_workspace, :versions_attributes => [{:contents => file}])
    end
    File.open Rails.root + 'spec/fixtures/binary.tar.gz' do |file|
      FactoryGirl.create(:chorus_workfile, :file_name => "binary.tar.gz", :owner => owner, :workspace => public_workspace, :versions_attributes => [{:contents => file}])
    end

    File.open Rails.root + 'spec/fixtures/test.cpp' do |file|
      FactoryGirl.create(:chorus_workfile, :file_name => "code.cpp", :owner => owner, :workspace => public_workspace, :versions_attributes => [{:contents => file}])
    end

    File.open Rails.root + 'spec/fixtures/model.pmml' do |file|
      FactoryGirl.create(:chorus_workfile, :file_name => 'model.pmml', :owner => owner, :workspace => public_workspace, :versions_attributes => [{:contents => file}])
    end

    ##Milestones
    default_milestone = FactoryGirl.create(:milestone, :workspace => public_workspace, target_date: Date.today + 2)
    fbuilder.name :default, default_milestone

    FactoryGirl.create(:milestone, :workspace => public_workspace, target_date: Date.today + 25)
    FactoryGirl.create(:milestone, :workspace => public_workspace, target_date: Date.today + 12)

    Events::MilestoneCreated.by(owner).add(:milestone => default_milestone, :workspace => default_milestone.workspace)
    Events::MilestoneUpdated.by(owner).add(:milestone => default_milestone, :workspace => default_milestone.workspace)

    ##Jobs
    default_job = FactoryGirl.create(:job, :workspace => public_workspace)
    fbuilder.name :default, default_job

    on_demand_job = FactoryGirl.create(:job, :workspace => public_workspace, :next_run => nil, :interval_unit => 'on_demand', :interval_value => 0)
    fbuilder.name :on_demand, on_demand_job

    FactoryGirl.create(:job, :workspace => public_workspace)
    FactoryGirl.create(:job, :workspace => public_workspace)

    import_table_destination = FactoryGirl.create(:gpdb_table, schema: default_schema)
    import_template = FactoryGirl.create(:existing_table_import_template, :source => default_table, :destination => import_table_destination)

    default_job_task = FactoryGirl.create(:import_source_data_task, :job => default_job, payload: import_template)
    fbuilder.name :default, default_job_task

    job_task_isdt = FactoryGirl.create(:import_source_data_task, :job => default_job, payload: import_template)
    fbuilder.name :isdt, job_task_isdt

    work_flow_task = FactoryGirl.create(:run_work_flow_task, :job => default_job, :payload => work_flow)
    fbuilder.name :rwft, work_flow_task

    sql_task = FactoryGirl.create(:run_sql_workfile_task, :job => default_job, :payload => @sql_workfile)
    fbuilder.name :rswt, sql_task

    FactoryGirl.create(:import_source_data_task, :job => default_job, payload: import_template)
    FactoryGirl.create(:import_source_data_task, :job => default_job, payload: import_template)
    a_result = FactoryGirl.create(:job_result, :job => default_job)
    b_result = FactoryGirl.create(:job_result, :job => default_job)
    fbuilder.name :default, b_result

    FactoryGirl.create(:run_work_flow_task_result, :job_result => a_result)

    FactoryGirl.create(:run_work_flow_task_result, :job_result => b_result)
    FactoryGirl.create(:job_task_result, :job_result => b_result)
    FactoryGirl.create(:job_task_result, :job_result => b_result)

    default_job.update_attribute(:last_run, b_result.started_at)

    @with_recent_results = FactoryGirl.create(:job, :workspace => public_workspace)
    recent_result = FactoryGirl.create(:job_result, :job => @with_recent_results)
    FactoryGirl.create(:run_work_flow_task_result, :job_result => recent_result)
    FactoryGirl.create(:job_task_result, :job_result => recent_result)
    FactoryGirl.create(:job_task_result, :job_result => recent_result)

    Events::JobSucceeded.by(owner).add(:job => default_job, :workspace => default_job.workspace, :job_result => b_result)
    Events::JobFailed.by(owner).add(:job => default_job, :workspace => default_job.workspace, :job_result => FactoryGirl.create(:job_result, :job => default_job, :succeeded => false))
    Events::JobDisabled.by(owner).add(:job => default_job, :workspace => default_job.workspace)
    Events::JobCreated.by(owner).add(:job => default_job, :workspace => default_job.workspace)
    Events::JobDeleted.by(owner).add(:job => default_job, :workspace => default_job.workspace)

    #CSV File
    csv_file = CsvFile.new({:user => the_collaborator, :workspace => public_workspace, :column_names => [:id], :types => [:integer], :delimiter => ',', :has_header => true, :to_table => 'table', :new_table => true, :contents_file_name => 'import.csv'}, :without_protection => true)
    csv_file.save!(:validate => false)

    csv_file_owner = CsvFile.new({:user => owner, :workspace => public_workspace, :column_names => [:id], :types => [:integer], :delimiter => ',', :has_header => true, :to_table => 'table', :new_table => true, :contents_file_name => 'import.csv'}, :without_protection => true)
    csv_file_owner.save!(:validate => false)
    fbuilder.name :default, csv_file_owner


    unimported_csv_file = CsvFile.new({:user => owner, :workspace => public_workspace, :column_names => [:id], :types => [:integer], :delimiter => ',', :has_header => true, :to_table => 'table_will_not_be_imported', :new_table => true, :contents_file_name => 'import.csv'}, :without_protection => true)
    unimported_csv_file.save!(:validate => false)
    fbuilder.name :unimported, unimported_csv_file

    #Upload
    default_upload = FactoryGirl.create(:upload, :user => the_collaborator)
    fbuilder.name :default, default_upload

    #Imports
    dataset_import_created = FactoryGirl.create(:dataset_import_created_event,
                                                :workspace => public_workspace, :dataset => nil,
                                                :source_dataset => default_table, :destination_table => 'new_table_for_import', :actor => owner
    )
    fbuilder.name :dataset_import_created, dataset_import_created

    schema_import = FactoryGirl.create(:schema_import, :user => owner, :to_table => "schema_import_table", :source => oracle_table, :schema => default_schema)
    fbuilder.name :oracle, schema_import

    import = FactoryGirl.create(:import, :user => owner, :workspace => public_workspace, :to_table => "new_table_for_import", :source => default_table)
    fbuilder.name :three, import

    previous_import = FactoryGirl.create(:import, :user => owner, :workspace => public_workspace, :to_table => "new_table_for_import", :created_at => '2012-09-04 23:00:00-07',
                                         :source => default_table)
    fbuilder.name :one, previous_import

    import_now = FactoryGirl.create(:import, :user => owner, :workspace => public_workspace, :to_table => "new_table_for_import",
                                         :created_at => '2012-09-03 23:00:00-07',
                                         :source => default_table)
    fbuilder.name :now, import_now

    other_schema = FactoryGirl.create(:gpdb_schema, database: default_database)
    csv_import_table = FactoryGirl.create(:gpdb_table, :name => "csv_import_table", schema: other_schema)

    public_workspace.source_datasets << csv_import_table

    csv_import = FactoryGirl.create(:csv_import, :user => owner, :workspace => public_workspace, :to_table => "csv_import_table",
                                    :destination_dataset => csv_import_table,
                                    :created_at => '2012-09-03 23:04:00-07',
                                    :csv_file => csv_file,
                                    :file_name => "import.csv")
    fbuilder.name :csv, csv_import

    fbuilder.name :gnip, FactoryGirl.create(:gnip_import, :user => owner, :workspace => public_workspace, :to_table => "gnip_import_table",
                                    :source => gnip_data_source)

    #Notes
    with_current_user(owner) do
      @note_on_greenplum = Events::NoteOnDataSource.create!({:note_target => gpdb_data_source, :body => 'i am a comment with greenplumsearch in me'}, :as => :create)
      @insight_on_greenplum = Events::NoteOnDataSource.create!({:note_target => gpdb_data_source, :body => 'i am an insight with greenpluminsight in me', :insight => true}, :as => :create)

      Events::NoteOnDataSource.create!({:note_target => gpdb_data_source, :body => 'i love searchquery'}, :as => :create)
      Events::NoteOnDataSource.create!({:note_target => shared_data_source, :body => 'is this a greenplumsearch data source?'}, :as => :create)
      Events::NoteOnDataSource.create!({:note_target => shared_data_source, :body => 'no, not greenplumsearch'}, :as => :create)
      Events::NoteOnDataSource.create!({:note_target => shared_data_source, :body => 'really really?'}, :as => :create)
      @note_on_hdfs_data_source = Events::NoteOnHdfsDataSource.create!({:note_target => hdfs_data_source, :body => 'hadoop-idy-doop'}, :as => :create)
      @note_on_hdfs_file = Events::NoteOnHdfsFile.create!({:note_target => @hdfs_file, :body => 'hhhhhhaaaadooooopppp'}, :as => :create)
      @note_on_workspace = Events::NoteOnWorkspace.create!({:note_target => public_workspace, :body => 'Come see my awesome workspace!'}, :as => :create)
      @insight_on_workspace = Events::NoteOnWorkspace.create!({:note_target => public_workspace, :body => 'This workspace is definitely awesome!', :insight => true}, :as => :create)
      @note_on_workfile = Events::NoteOnWorkfile.create!({:note_target => text_workfile, :body => "My awesome workfile"}, :as => :create)
      @note_on_gnip_data_source = Events::NoteOnGnipDataSource.create!({:note_target => gnip_data_source, :body => 'i am a comment with gnipsearch in me'}, :as => :create)
      @insight_on_gnip_data_source = Events::NoteOnGnipDataSource.create!({:note_target => gnip_data_source, :body => 'i am an insight with gnipinsight in me', :insight => true}, :as => :create)

      Events::NoteOnDataset.create!({:note_target => default_table, :body => 'Note on dataset'}, :as => :create)
      Events::NoteOnWorkspaceDataset.create!({:note_target => default_table, :workspace => public_workspace, :body => 'Note on workspace dataset'}, :as => :create)
      @note_on_dataset = Events::NoteOnDataset.create!({:dataset => searchquery_table, :body => 'notesearch ftw'}, :as => :create)
      @insight_on_dataset = Events::NoteOnDataset.create!({:dataset => searchquery_table, :body => 'insightsearch ftw'}, :as => :create)
      @insight_on_dataset.promote_to_insight
      @note_on_chorus_view_private = Events::NoteOnWorkspaceDataset.create!({:dataset => searchquery_chorus_view_private, :workspace => searchquery_chorus_view_private.workspace, :body => 'workspacedatasetnotesearch'}, :as => :create)
      @note_on_search_workspace_dataset = Events::NoteOnWorkspaceDataset.create!({:dataset => searchquery_table, :workspace => public_workspace, :body => 'workspacedatasetnotesearch'}, :as => :create)
      @note_on_workspace_dataset = Events::NoteOnWorkspaceDataset.create!({:dataset => source_table, :workspace => public_workspace, :body => 'workspacedatasetnotesearch'}, :as => :create)

      fbuilder.name :note_on_public_workspace, Events::NoteOnWorkspace.create!({:workspace => public_workspace, :body => 'notesearch forever'}, :as => :create)
    end

    Events::FileImportSuccess.by(the_collaborator).create!(:dataset => default_table, :workspace => public_workspace)

    with_current_user(no_collaborators) do
      @note_on_no_collaborators_private = Events::NoteOnWorkspace.create!({:note_target => no_collaborators_private_workspace, :body => 'notesearch never'}, :as => :create)
      @note_on_no_collaborators_public = Events::NoteOnWorkspace.create!({:note_target => no_collaborators_public_workspace, :body => 'some stuff'}, :as => :create)
    end

    #Comments
    comment_on_note_on_greenplum = Comment.create!({:body => "Comment on Note on Greenplum", :event_id => @note_on_greenplum.id, :author_id => owner.id})
    fbuilder.name :comment_on_note_on_greenplum, comment_on_note_on_greenplum

    second_comment_on_note_on_greenplum = Comment.create!({:body => "2nd Comment on Note on Greenplum", :event_id => @note_on_greenplum.id, :author_id => the_collaborator.id})
    fbuilder.name :second_comment_on_note_on_greenplum, second_comment_on_note_on_greenplum

    fbuilder.name :comment_on_note_on_no_collaborators_private,
                  Comment.create!({:body => "Comment on no collaborators private", :event_id => @note_on_no_collaborators_private.id, :author_id => no_collaborators.id})

    comment_on_note_on_dataset = Comment.create!({:body => "commentsearch ftw", :event_id => @note_on_dataset.id, :author_id => owner.id})
    fbuilder.name :comment_on_note_on_dataset, comment_on_note_on_dataset

    Comment.create!({:body => "commentsearch", :event_id => @note_on_chorus_view_private.id, :author_id => owner.id})


    #Events
    Timecop.travel(-1.day)

    import.errors.add(:base, :table_not_consistent, {:src_table_name => default_table.name, :dest_table_name => other_table.name})
    @import_failed_with_model_errors = Events::WorkspaceImportFailed.by(owner).add(:workspace => public_workspace, :source_dataset => default_table, :destination_table => other_table.name, :error_objects => import.errors, :dataset => other_table)

    @schema_import_success = Events::SchemaImportSuccess.by(owner).add(:dataset => default_table, :source_dataset => oracle_table)
    @schema_import_failed = Events::SchemaImportFailed.by(owner).add(:dataset => default_table, :source_dataset => oracle_table, :destination_table => 'other_table', :error_message => "oh no's! everything is broken!", :schema_id => default_table.schema.id)
    Events::HdfsImportSuccess.by(owner).add(:hdfs_entry => @hdfs_file, :hdfs_data_source => hdfs_data_source)
    Events::HdfsImportFailed.by(owner).add(:hdfs_data_source => hdfs_data_source, :error_message => 'catastrophe!', :file_name => 'original.csv')
    Events::DataSourceChangedOwner.by(admin).add(:data_source => gpdb_data_source, :new_owner => no_collaborators)
    Events::DataSourceChangedName.by(admin).add(:data_source => gpdb_data_source, :old_name => 'mahna_mahna', :new_name => gpdb_data_source.name)
    Events::HdfsDataSourceChangedName.by(admin).add(:hdfs_data_source => hdfs_data_source, :old_name => 'Slartibartfast', :new_name => hdfs_data_source.name)
    @source_table_created = Events::SourceTableCreated.by(admin).add(:dataset => hadoop_dadoop, :workspace => public_workspace)
    Events::WorkspaceAddSandbox.by(owner).add(:sandbox_schema => default_schema, :workspace => public_workspace)
    Events::WorkspaceArchived.by(admin).add(:workspace => public_workspace)
    Events::WorkspaceUnarchived.by(admin).add(:workspace => public_workspace)
    Events::WorkspaceChangeName.by(admin).add(:workspace => public_workspace, :workspace_old_name => 'old_name')
    Events::HdfsDatasetExtTableCreated.by(owner).add(:workspace => public_workspace, :dataset => default_table, :hdfs_dataset => HdfsDataset.last)
    Events::HdfsFileExtTableCreated.by(owner).add(:workspace => public_workspace, :dataset => default_table, :hdfs_entry => @hdfs_file)
    Events::HdfsDirectoryExtTableCreated.by(owner).add(:workspace => public_workspace, :dataset => default_table, :hdfs_entry => @directory)
    Events::HdfsPatternExtTableCreated.by(owner).add(:workspace => public_workspace, :dataset => default_table, :hdfs_entry => @hdfs_file, :file_pattern => "*.csv")
    Events::FileImportCreated.by(owner).add(:workspace => public_workspace, :dataset => nil, :file_name => 'import.csv', :import_type => 'file', :destination_table => 'table')
    Events::FileImportSuccess.by(owner).add(:workspace => public_workspace, :dataset => default_table, :file_name => 'import.csv', :import_type => 'file')
    Events::FileImportFailed.by(owner).add(:workspace => public_workspace, :file_name => 'import.csv', :import_type => 'file', :destination_table => 'my_table', :error_message => "oh no's! everything is broken!")
    Events::MembersAdded.by(owner).add(:workspace => public_workspace, :member => the_collaborator, :num_added => 5)
    Events::WorkspaceImportCreated.by(owner).add(:workspace => public_workspace, :dataset => nil, :source_dataset => default_table, :destination_table => 'other_table')
    Events::WorkspaceImportSuccess.by(owner).add(:workspace => public_workspace, :dataset => other_table, :source_dataset => default_table)
    Events::WorkspaceImportFailed.by(owner).add(:workspace => public_workspace, :source_dataset => default_table, :destination_table => 'other_table', :error_message => "oh no's! everything is broken!")
    fbuilder.name :gnip_stream_import_created, Events::GnipStreamImportCreated.by(owner).add(:workspace => public_workspace, :destination_table => other_table.name, :gnip_data_source => gnip_data_source)
    Events::GnipStreamImportSuccess.by(owner).add(:workspace => public_workspace, :dataset => other_table, :gnip_data_source => gnip_data_source)
    Events::GnipStreamImportFailed.by(owner).add(:workspace => public_workspace, :destination_table => other_table.name, :error_message => "an error", :gnip_data_source => gnip_data_source)
    Events::ChorusViewCreated.by(owner).add(:dataset => chorus_view, :workspace => public_workspace, :source_object => default_table)
    Events::ImportScheduleUpdated.by(owner).add(:workspace => public_workspace, :dataset => nil, :source_dataset => default_table, :destination_table => 'other_table')
    Events::ImportScheduleDeleted.by(owner).add(:workspace => public_workspace, :dataset => nil, :source_dataset => default_table, :destination_table => 'other_table_deleted')
    Events::CredentialsInvalid.by(owner).add(:data_source => gpdb_data_source)
    Timecop.return

    #NotesAttachment
    @sql = @note_on_greenplum.attachments.create!(:contents => File.new(Rails.root.join('spec', 'fixtures', 'workfile.sql')))
    @image = @note_on_greenplum.attachments.create!(:contents => File.new(Rails.root.join('spec', 'fixtures', 'User.png')))
    @attachment = @note_on_greenplum.attachments.create!(:contents => File.new(Rails.root.join('spec', 'fixtures', 'searchquery_data_source')))
    @attachment_workspace = @note_on_workspace.attachments.create!(:contents => File.new(Rails.root.join('spec', 'fixtures', 'searchquery_workspace')))
    @attachment_private_workspace = @note_on_no_collaborators_private.attachments.create!(:contents => File.new(Rails.root.join('spec', 'fixtures', 'searchquery_workspace')))
    @attachment_workfile = @note_on_workfile.attachments.create!(:contents => File.new(Rails.root.join('spec', 'fixtures', 'searchquery_workfile')))
    @attachment_private_workfile = @note_on_no_collaborators_private_workfile.attachments.create!(:contents => File.new(Rails.root.join('spec', 'fixtures', 'searchquery_workspace')))
    @attachment_dataset = @note_on_dataset.attachments.create!(:contents => File.new(Rails.root.join('spec', 'fixtures', 'searchquery_dataset')))
    @attachment_hadoop = @note_on_hdfs_data_source.attachments.create!(:contents => File.new(Rails.root.join('spec', 'fixtures', 'searchquery_hadoop')))
    @attachment_hdfs = @note_on_hdfs_file.attachments.create!(:contents => File.new(Rails.root.join('spec', 'fixtures', 'searchquery_hdfs_file')))
    @attachment_workspace_dataset = @note_on_search_workspace_dataset.attachments.create!(:contents => File.new(Rails.root.join('spec', 'fixtures', 'searchquery_workspace_dataset')))
    @attachment_on_chorus_view = @note_on_chorus_view_private.attachments.create!(:contents => File.new(Rails.root.join('spec', 'fixtures', 'attachmentsearch')))

    RR.reset

    if ENV['GPDB_HOST']
      chorus_gpdb40 = FactoryGirl.create(:gpdb_data_source, GreenplumIntegration.data_source_config("chorus-gpdb40").merge(:name => "chorus_gpdb40", :owner => admin))
      chorus_gpdb41 = FactoryGirl.create(:gpdb_data_source, GreenplumIntegration.data_source_config("chorus-gpdb41").merge(:name => "chorus_gpdb41", :owner => admin))
      chorus_gpdb42 = FactoryGirl.create(:gpdb_data_source, GreenplumIntegration.data_source_config(GreenplumIntegration.hostname).merge(:name => GreenplumIntegration.hostname, :owner => admin))

      @chorus_gpdb42_test_superuser = chorus_gpdb42.account_for_user(admin)

      FactoryGirl.create(:data_source_account, GreenplumIntegration.account_config(GreenplumIntegration.hostname).merge(:owner => the_collaborator, :data_source => chorus_gpdb42))
      FactoryGirl.create(:data_source_account, GreenplumIntegration.account_config(GreenplumIntegration.hostname).merge(:owner => owner, :data_source => chorus_gpdb42))

      GreenplumIntegration.refresh_chorus
      chorus_gpdb42.refresh_databases(:skip_schema_refresh => true)
      Schema.refresh(@chorus_gpdb42_test_superuser, chorus_gpdb42.databases.find_by_name(GreenplumIntegration.database_name), :refresh_all => true)

      test_database = GpdbDatabase.find_by_name_and_data_source_id(GreenplumIntegration.database_name, GreenplumIntegration.real_data_source)
      test_schema = test_database.schemas.find_by_name('test_schema')

      real_workspace = owner.owned_workspaces.create!({:name => "Real", :summary => "A real workspace with a sandbox on local-greenplum", :sandbox => test_schema, :public => true}, :without_protection => true)
      fbuilder.name :real, real_workspace

      @executable_chorus_view = FactoryGirl.create(:chorus_view, :name => "CHORUS_VIEW", :schema => test_schema, :query => "select * from test_schema.base_table1;", :workspace => public_workspace)
      @gpdb_workspace = FactoryGirl.create(:workspace, :name => "Workspace with a real GPDB sandbox", :owner => owner, :sandbox => test_schema)
      @convert_chorus_view = FactoryGirl.create(:chorus_view, :name => "convert_to_database", :schema => test_schema, :query => "select * from test_schema.base_table1;", :workspace => @gpdb_workspace)

      test_schema2 = test_database.schemas.find_by_name('test_schema2')
      @gpdb_workspace.source_datasets << test_schema2.active_tables_and_views.first

      real_chorus_view = FactoryGirl.create(:chorus_view,
                                               :name => "real_chorus_view",
                                               :schema => test_schema,
                                               :query => "select 1",
                                               :workspace => real_workspace)
    end

    if ENV['PG_HOST']
      chorus_pg = FactoryGirl.create(:pg_data_source, PostgresIntegration.data_source_config.merge(:owner => admin))
      FactoryGirl.create(:data_source_account, :db_username => PostgresIntegration.username, :db_password => PostgresIntegration.password, :owner => owner, :data_source => chorus_pg)
      PostgresIntegration.setup
      PostgresIntegration.refresh
    end

    if ENV['HADOOP_HOST']
      puts :hdfs_data_source
      puts HdfsIntegration.data_source_config['host']
      puts HdfsIntegration.data_source_config['port']
      @real = FactoryGirl.create(:hdfs_data_source, :owner => owner, :host => HdfsIntegration.data_source_config['host'], :port => HdfsIntegration.data_source_config['port'])
    end

    if ENV['ORACLE_HOST'] && OracleIntegration.has_jar_file?
      real_oracle_data_source = FactoryGirl.create(:oracle_data_source, :owner => owner, :host => OracleIntegration.hostname, :port => OracleIntegration.port, :db_name => OracleIntegration.db_name, :db_username => OracleIntegration.username, :db_password => OracleIntegration.password)
      OracleIntegration.setup_test_schemas
      FactoryGirl.create(:oracle_schema, :name => OracleIntegration.schema_name, :data_source => real_oracle_data_source)
      OracleIntegration.real_schema.refresh_datasets(real_oracle_data_source.account_for_user!(owner))
    end

    if ENV['JDBC_HOST']
      real_jdbc_data_source = FactoryGirl.create(:jdbc_data_source, :owner => owner, :host => JdbcIntegration.hostname, :db_username => JdbcIntegration.username, :db_password => JdbcIntegration.password)
      JdbcIntegration.setup_test_schemas
      FactoryGirl.create(:jdbc_schema, :name => JdbcIntegration.schema_name, :data_source => real_jdbc_data_source)
    end

    if ENV['MARIADB_HOST']
      mariadb_jdbc_data_source = FactoryGirl.create(:jdbc_data_source, :owner => owner, :host => MariadbIntegration.hostname, :db_username => MariadbIntegration.username, :db_password => MariadbIntegration.password)
      MariadbIntegration.setup_test_schemas
      FactoryGirl.create(:jdbc_schema, :name => MariadbIntegration.schema_name, :data_source => mariadb_jdbc_data_source)
    end

    if ENV['HAWQ_HOST']
      FactoryGirl.create(:gpdb_data_source, HawqIntegration.data_source_config(HawqIntegration.hostname).merge(:name => HawqIntegration.hostname, :owner => admin))
    end

    #Notification
    notes = Events::NoteOnDataSource.by(owner).order(:id)

    @notification1 = Notification.create!({:recipient => owner, :event => notes[0], :comment => second_comment_on_note_on_greenplum}, :without_protection => true)

    3.times do |i|
      Timecop.freeze(Time.now + i + 1) do
        instance_variable_set :"@notification#{i + 2}", Notification.create!({:recipient => owner, :event => notes[i + 1]}, :without_protection => true)
      end
    end

    bad_workfiles = ChorusWorkfile.select { |x| x.versions.empty? && x.class.name != "LinkedTableauWorkfile" }
    if !bad_workfiles.empty?
      raise "OH NO!  A workfile has no versions!  Be more careful in the future." + bad_workfiles.map(&:file_name).inspect
    end

    bad_users = User.select { |u| u.username.starts_with?('user') }
    if !bad_users.empty?
      raise "OH NO!  A user was created with an autogenerated name. All users created in fixtures should be named! Perhaps a factory ran amok?"
    end

    Sunspot.session = Sunspot.session.original_session if Sunspot.session.is_a? SunspotMatchers::SunspotSessionSpy
    #Nothing should go ↓ here.  Resetting the sunspot session should be the last thing in this file.
  end
end
