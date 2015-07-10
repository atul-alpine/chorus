require 'factory_girl'

FactoryGirl.define do
  factory :event, :class => Events::Base do
    actor

    factory :data_source_created_event, :class => Events::DataSourceCreated do
      association :data_source, :factory => :gpdb_data_source
    end

    factory :hadoop_data_source_created_event, :class => Events::HdfsDataSourceCreated do
      hdfs_data_source
    end

    factory :data_source_changed_owner_event, :class => Events::DataSourceChangedOwner do
      data_source { create :data_source }
      new_owner :factory => :user
    end

    factory :data_source_changed_name_event, :class => Events::DataSourceChangedName do
      data_source { create :data_source }
      new_name 'new_data_source_name'
      old_name 'old_data_source_name'
    end

    factory :hdfs_data_source_changed_name_event, :class => Events::HdfsDataSourceChangedName do
      hdfs_data_source
      new_name 'new_data_source_name'
      old_name 'old_data_source_name'
    end

    factory :workfile_created_event, :class => Events::WorkfileCreated do
      workfile { FactoryGirl.create(:workfile_version).workfile }
      workspace
    end

    factory :source_table_created_event, :class => Events::SourceTableCreated do
      association :dataset, :factory => :gpdb_table
      workspace
    end

    factory :user_created_event, :class => Events::UserAdded do
      association :new_user, :factory => :user
    end

    factory :sandbox_added_event, :class => Events::WorkspaceAddSandbox do
      workspace
    end

    factory :hdfs_external_table_created_event, :class => Events::HdfsFileExtTableCreated do
      association :dataset, :factory => :gpdb_table
      association :hdfs_file, :factory => :hdfs_entry
      workspace
    end

    factory :note_on_data_source_event, :class => Events::NoteOnDataSource do
      data_source { create :gpdb_data_source }
      body 'Note to self, add a body'
    end

    factory :note_on_hdfs_data_source_event, :class => Events::NoteOnHdfsDataSource do
      hdfs_data_source
      body 'Note to self, add a body'
    end

    factory :note_on_hdfs_file_event, :class => Events::NoteOnHdfsFile do
      association :hdfs_file, :factory => :hdfs_entry
      body 'This is a note on an hdfs file'
    end

    factory :note_on_workspace_event, :class => Events::NoteOnWorkspace do
      association :workspace, :factory => :workspace
      body 'This is a note on a workspace'
    end

    factory :note_on_workfile, :class => Events::NoteOnWorkfile do
      association :workfile, :factory => :workfile
      body 'This is a note on a workfile'
    end

    factory :dataset_import_created_event, :class => Events::WorkspaceImportCreated do
      association :source_dataset, :factory => :gpdb_table
      destination_table 'new_table_for_import'
      workspace
    end

    factory :workfile_result, :class => Events::WorkfileResult do
      association :workfile, :factory => :workfile
    end

    factory :milestone_created_event, :class => Events::MilestoneCreated do
      milestone { FactoryGirl.create(:milestones) }
      workspace
    end

    factory :milestone_updated_event, :class => Events::MilestoneUpdated do
      milestone { FactoryGirl.create(:milestones) }
      state 'achieved'
      workspace
    end

    factory :job_created_event, :class => Events::JobCreated do
      job { FactoryGirl.create(:job) }

    end

    factory :job_deleted_event, :class => Events::JobDeleted do
      job { FactoryGirl.create(:job) }


    end
  end
end
