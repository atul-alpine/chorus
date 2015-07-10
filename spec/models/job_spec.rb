require 'spec_helper'

describe Job do
  let(:ready_job) { FactoryGirl.create(:job, :status => Job::ENQUEUED, :next_run => 1.second.ago) }

  describe 'validations' do
    it { should validate_presence_of :name }
    it { should validate_presence_of :interval_unit }
    it { should validate_presence_of :interval_value }
    it { should ensure_inclusion_of(:interval_unit).in_array(Job::VALID_INTERVAL_UNITS) }
    it { should ensure_inclusion_of(:status).in_array(Job::STATUSES) }
    it { should have_many :job_tasks }
    it { should have_many :job_results }
    it { should have_many :events }
    it { should belong_to :owner }
    it { should belong_to :workspace }

    describe 'name uniqueness validation' do
      let(:workspace) { workspaces(:public) }
      let(:other_workspace) { workspaces(:private) }
      let(:existing_job) { workspace.jobs.first! }

      it 'is invalid if a job in the workspace has the same name' do
        new_job = FactoryGirl.build(:job, :name => existing_job.name, :workspace => workspace)
        new_job.should_not be_valid
        new_job.should have_error_on(:name)
      end

      it 'enforces uniqueness only among non-deleted jobs' do
        existing_job.destroy
        new_job = FactoryGirl.build(:job, :name => existing_job.name, :workspace => workspace)
        new_job.should be_valid
      end

      it 'is valid if a job in another workspace has the same name' do
        new_job = FactoryGirl.build(:job, :name => existing_job.name, :workspace => other_workspace)
        new_job.should be_valid
      end

      it 'is invalid if you change a name to an existing name' do
        new_job = FactoryGirl.build(:job, :name => 'totally_unique', :workspace => workspace)
        new_job.should be_valid
        new_job.name = existing_job.name
        new_job.should_not be_valid
      end
    end

    describe 'next_run validations' do
      it 'is invalid if the next_run is in the past' do
        new_job = FactoryGirl.build(:job, :next_run => 1.hour.ago)
        new_job.should_not be_valid
        new_job.should have_error_on(:job)
      end
    end

    describe 'end_run validations' do
      it 'prohibits end_run date from being scheduled in the past' do
        impossible_job = FactoryGirl.build(:job, :end_run => 1.day.ago)
        impossible_job.should_not be_valid
        impossible_job.should have_error_on(:job).with_message(:END_RUN_IN_PAST)
      end
    end

    describe 'owner workspace membership' do
      let(:impossible_owner) { users(:no_collaborators) }

      it 'should require the owner to be a member of the workspace or an admin' do
        ready_job.owner = impossible_owner
        ready_job.should_not be_valid
        ready_job.should have_error_on(:owner).with_message(:JOB_OWNER_MEMBERSHIP_REQUIRED)
        ready_job.owner = users(:admin)
        ready_job.should be_valid
      end
    end
  end

  describe '#create!' do
    it 'makes a disabled Job by default' do
      FactoryGirl.create(:job).should_not be_enabled
    end

    it 'creates activity after user creates a Job' do
     expect do
          Events::JobCreated.add(
             :actor => actor,
             :job => job,
             :workspace => workspace
            )
        end
     end
  end

  describe 'scheduling' do
    describe '.ready_to_run' do
      let(:job1) do
        temp = FactoryGirl.build(:job, :name => 'past_enabled', :next_run => 30.seconds.ago, :enabled => true)
        temp.save!(:validate => false)
        temp
      end
      let(:job2) { FactoryGirl.create(:job, :name => 'future_enabled', :next_run => 1.day.from_now, :enabled => true) }
      let(:job3) do
        temp = FactoryGirl.build(:job, :name => 'past_disabled', :next_run => 1.day.ago, :enabled => false)
        temp.save!(:validate => false)
        temp
      end

      before do
        Job.delete_all
        [job1, job2, job3] # Initialize lets
      end

      it 'returns only enabled jobs that should have run by now' do
        Job.ready_to_run.all.should == [job1]
      end
    end

    describe '.awaiting_stop' do
      let(:found) { FactoryGirl.create(:job, :name => 'stalled', :status => Job::STOPPING, :enabled => true) }
      let(:not_found) { FactoryGirl.create(:job, :name => 'just_stalled', :status => Job::STOPPING, :enabled => true) }
      let(:job2) { FactoryGirl.create(:job, :name => 'future_enabled', :next_run => 1.day.from_now, :enabled => true) }
      let(:job3) { FactoryGirl.create(:job, :name => 'is_running', :status => Job::RUNNING, :next_run => 1.day.from_now, :enabled => true) }

      before do
        Job.delete_all
        [found, not_found, job2, job3] # Initialize lets
      end

      it 'returns only stopping jobs last updated more than 1 minute ago' do
        Timecop.freeze(Time.now) do
          Timecop.travel(1.minutes)
          not_found.touch
          Job.awaiting_stop.should == [found]
        end
      end
    end

    describe '.run' do
      let(:job) do
        jobs(:default).tap { |job| mock(job).run }
      end

      it 'tells the given job to run itself' do
        mock(Job).find(job.id) { job }
        Job.run job.id
      end

      context 'when the Job was stopped before being picked from the queue' do
        let(:stopped_job) { FactoryGirl.create(:job, :status => Job::STOPPING) }

        before do
          stub(Job).find(stopped_job.id) { stopped_job }
        end

        it 'does not run any tasks' do
          dont_allow(stopped_job).perform_tasks
          expect {
            Job.run stopped_job.id
          }.to raise_error ApiValidationError
        end
      end
    end

    describe '#enqueue' do
      let(:job) { FactoryGirl.create(:job, :status => Job::IDLE, :next_run => 1.second.ago) }

      it 'puts itself into the worker queue if not already there' do
        mock(QC.default_queue).enqueue_if_not_queued('Job.run', job.id)
        job.enqueue
      end

      it 'sets the status to enqueued' do
        expect {
          job.enqueue
        }.to change(job, :status).from(Job::IDLE).to(Job::ENQUEUED)
      end
    end
  end

  describe '#run' do
    context 'for on demand jobs' do
      let(:job) do
        jobs(:on_demand).tap do |job|
          FactoryGirl.create(:run_work_flow_task, :job => job)
          FactoryGirl.create(:import_source_data_task, :job => job)
        end
      end

      it 'performs all tasks' do
        job.job_tasks.each {|task| mock(task).perform { FactoryGirl.build(:job_task_result) } }
        job.status = Job::ENQUEUED
        job.run
      end
    end

    context 'for scheduled jobs' do
      let(:job) { ready_job }

      it 'updates the next run time' do
        og_next_run = job.next_run
        Timecop.freeze do
          job.run
          job.next_run.to_i.should == job.frequency.since(og_next_run).to_i
        end
      end

      it 'updates the last run time' do
        Timecop.freeze do
          job.run
          job.last_run.to_i.should == Time.current.to_i
        end
      end

      context 'when the job finishes running' do
        it 'updates the status to "idle"' do
          job.run
          job.status.should == Job::IDLE
        end
      end

      context 'if the end_run date is before the new next_run' do
        let(:expiring_job) do
          FactoryGirl.create(:job, :status => Job::ENQUEUED, :interval_unit => 'weeks', :next_run => Time.current,
                             :end_run => 1.day.from_now.to_date, enabled: true, workspace: workspaces(:public))
        end

        it 'disables the job' do
          stub(expiring_job).perform_tasks { true }
          expect do
            expiring_job.run
          end.to change(expiring_job, :enabled).from(true).to(false)
        end
      end

      context 'if there is no end_run' do
        let(:forever_job) do
          jobs(:default).tap do |job|
            job.end_run = nil
            job.status = Job::ENQUEUED
            job.enable!
            job.save!
          end
        end

        it 'does not disable the job' do
          stub(forever_job).perform_tasks { true }
          expect do
            forever_job.run
          end.to_not change(forever_job, :enabled)
        end
      end

      describe 'executing each task' do
        class FakeJobTask < JobTask
          Order = []

          def perform
            Order << index
            FactoryGirl.build(:job_task_result)
          end
        end

        let(:job) { FactoryGirl.create(:job, :status => Job::ENQUEUED) }
        let!(:tasks) do
          3.times.map { FactoryGirl.create(:job_task, job: job, type: 'FakeJobTask') }
        end

        it 'is done in index order' do
          job.run
          FakeJobTask::Order.length.should == 3
          FakeJobTask::Order.should == FakeJobTask::Order.sort
        end
      end
    end

    describe 'success' do
      let(:job) { ready_job }
      let!(:tasks) do
        3.times.map { FactoryGirl.create(:run_work_flow_task, job: job) }
      end

      before { any_instance_of(RunWorkFlowTask) { |task| stub(task).perform { FactoryGirl.build(:job_task_result) } } }

      it 'creates a JobSucceeded event' do
        expect do
          job.run
        end.to change(Events::JobSucceeded, :count).by(1)
      end

      it 'creates a JobResult with :succeeded true' do
        expect {
          expect {
            job.run
          }.to change(JobResult, :count).by(1)
        }.to change(JobTaskResult, :count).by(tasks.count)

        JobResult.last.succeeded.should be_true
      end
    end

    describe 'failure' do
      let(:job) { ready_job }
      let!(:tasks) do
        3.times.map { FactoryGirl.create(:run_work_flow_task, job: job) }
      end

      before { any_instance_of(RunWorkFlowTask) { |build| stub(build).perform { FactoryGirl.build(:failed_job_task_result) } } }

      it 'creates a JobFailed event' do
        expect do
          job.run
        end.to change(Events::JobFailed, :count).by(1)
      end

      it 'creates a JobResult with :succeeded false' do
        expect {
          expect {
            job.run
          }.to change(JobResult, :count).by(1)
        }.to change(JobTaskResult, :count).by(1)

        JobResult.last.succeeded.should be_false
      end
    end
  end

  describe 'on update' do
    context 'with an on demand job' do
      let(:job) { jobs(:on_demand) }

      it 'does not error' do
        job.save!
      end
    end

    context 'with a scheduled job' do
      let(:impossible_job) { FactoryGirl.create(:job, :next_run => 1.hour.from_now, :end_run => Time.current) }

      it 'disables expiring jobs on update' do
        impossible_job.save!
        impossible_job.should_not be_enabled
      end

      context 'when switching to on demand' do
        let(:job) { FactoryGirl.create(:job, :next_run => 1.hour.from_now, :end_run => 15.days.from_now) }

        it 'should not error on next run/end run validations' do
          job.update_attributes!(:next_run => 'invalid', :interval_unit => 'on_demand')
          job.interval_unit.should == 'on_demand'
        end
      end
    end
  end

  describe '#enable!' do
    Timecop.freeze do
      let(:job) do
        job = FactoryGirl.create(:job, :enabled => false, :interval_unit => 'hours', :interval_value => 1)
        job.update_attribute(:next_run, 55.minutes.ago)
        job
      end

      it 'increments the next run to the next valid time' do
        job.enable!
        job.next_run.to_i.should == 5.minutes.from_now.to_i
      end
    end
  end

  describe '#kill' do
    let(:job) { ready_job }
    let!(:tasks) do
      3.times.map do
        FactoryGirl.create(:run_work_flow_task, job: job)
      end
    end

    it 'kills all tasks' do
      job.job_tasks.each {|task| mock(task).kill { true } }
      job.kill
    end

    it 'sets the status to stopping' do
      job.update_attribute(:status, Job::RUNNING)
      expect do
        job.kill
      end.to change(job.reload, :status).from(Job::RUNNING).to(Job::STOPPING)
    end
  end

  describe 'recipients' do
    let(:job) { ready_job }

    it 'differentiate based on completion conditions' do
      user_one, user_two = 2.times.map { FactoryGirl.create(:user) }

      job.notify_on :success, user_one
      job.notify_on :failure, user_one
      job.notify_on :failure, user_two

      job.reload.success_recipients.map(&:id).should =~ [user_one].map(&:id)
      job.reload.failure_recipients.map(&:id).should =~ [user_one, user_two].map(&:id)
    end

    it 'makes one record per user, per condition' do
      user_once = FactoryGirl.create(:user)
      user_twice = FactoryGirl.create(:user)

      expect do
        job.notify_on :success, user_once
        job.notify_on :success, user_once

        job.notify_on :success, user_twice
        job.notify_on :failure, user_twice
      end.to change(JobSubscription, :count).by(3)
    end

    it 'is reversible' do
      user_one = FactoryGirl.create(:user)

      job.notify_on :success, user_one
      job.notify_on :failure, user_one

      expect do
        job.dont_notify_on :success, user_one
      end.to change(JobSubscription, :count).by(-1)
    end
  end

  describe 'reorder tasks' do
    let(:job) { ready_job }
    let!(:tasks) do
      3.times.map { FactoryGirl.create(:run_work_flow_task, job: job) }
    end

    it 'assigns tasks indices in the order of the provided IDs' do
      desired_order = [tasks[1].id, tasks[0].id, tasks[2].id]

      expect do
        job.reorder_tasks desired_order
      end.to change { job.job_tasks.reload.map(&:id) }.to(desired_order)
    end

    context 'when a task has been added' do
      it 'safely assigns tasks indices' do
        desired_order = [tasks[1].id, tasks[0].id, tasks[2].id]
        new_task = FactoryGirl.create(:run_work_flow_task, job: job)

        expect do
          job.reorder_tasks desired_order
        end.to change { job.job_tasks.reload.map(&:id) }.to(desired_order + [new_task.id])
      end
    end

    context 'when a task has been removed' do
      it 'safely assigns task indices' do
        desired_order = [tasks[1].id, tasks[0].id, tasks[2].id]
        job.job_tasks.first.destroy
        job.reorder_tasks desired_order
        job.job_tasks.reload.map(&:id).should == [tasks[1].id,tasks[2].id]
      end
    end
  end

  describe '#reset_ownership!' do
    let(:workspace) { workspaces(:public) }
    let(:job_owner) { users(:the_collaborator) }
    let(:job) { FactoryGirl.create(:job, :workspace => workspace, :owner => job_owner) }

    it 'changes the owner to the workspace owner' do
      workspace.owner.should_not == job_owner
      expect {
        job.reset_ownership!
      }.to change(job, :owner).from(job_owner).to(workspace.owner)
    end
  end

end
