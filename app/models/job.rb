class Job < ActiveRecord::Base
  include SoftDelete

  ENQUEUED = 'enqueued'
  RUNNING = 'running'
  IDLE = 'idle'
  STOPPING = 'stopping'

  STATUSES = [ENQUEUED, RUNNING, IDLE, STOPPING]
  VALID_INTERVAL_UNITS = %w(hours days weeks months on_demand)

  attr_accessible :enabled, :name, :next_run, :last_run, :interval_unit, :interval_value, :end_run, :time_zone, :status, :success_notify, :failure_notify

  belongs_to :workspace, :touch => true  #:counter_cache =>  true
  belongs_to :owner, :class_name => 'User', :touch => true  #:counter_cache =>  true

  has_many :job_tasks, :order => :index
  has_many :job_results, :order => :finished_at
  has_many :activities, :as => :entity
  has_many :events, :through => :activities
  has_many :comments, :through => :events
  has_many :most_recent_comments, :through => :events, :source => :comments, :class_name => "Comment", :order => "id DESC", :limit => 1
  has_many :job_subscriptions
  has_many :success_recipients, :through => :job_subscriptions, :source => :user, :conditions => ['job_subscriptions.condition = ?', 'success']
  has_many :failure_recipients, :through => :job_subscriptions, :source => :user, :conditions => ['job_subscriptions.condition = ?', 'failure']

  validates :interval_unit, :presence => true, :inclusion => {:in => VALID_INTERVAL_UNITS }
  validates :status, :presence => true, :inclusion => {:in => STATUSES }
  validates_presence_of :interval_value
  validates_presence_of :name
  validates_presence_of :owner
  validates_presence_of :workspace
  validates_uniqueness_of :name, :scope => [:workspace_id, :deleted_at]
  validate :next_run_not_in_past, :if => Proc.new { |job| job.changed.include?('next_run') }
  validate :end_run_not_in_past, :if => :end_run
  validate :owner_can_edit, :on => :update

  scope :ready_to_run, -> { where(enabled: true).where(status: IDLE).where('next_run <= ?', Time.current).order(:next_run) }
  scope :awaiting_stop, -> { where(status: STOPPING).where('updated_at < ?', 1.minutes.ago) }

  after_create :create_job_created_event , :if => :current_user
  after_destroy :create_job_deleted_event , :if => :current_user

  def self.eager_load_associations
    [
        :success_recipients,
        :failure_recipients
    ]
  end

  def self.order_by(column_name)
    if column_name.blank? || column_name == 'name'
      return order('lower(name), id')
    end

    if %w(next_run).include?(column_name)
      order("#{column_name} asc")
    end
  end

  def self.run(id)
    find(id).run
  end

  def enqueue
    update_attributes!(:status => ENQUEUED)
    QC.enqueue_if_not_queued('Job.run', id)
  end

  def run
    raise ApiValidationError.new(:base, :not_enqueued) unless enqueued?
    prepare_to_run!
    initialize_results
    perform_tasks
    finalize_results_and_event Events::JobSucceeded
  rescue JobTask::JobTaskFailure
    finalize_results_and_event Events::JobFailed
  rescue ApiValidationError
    Chorus.log_debug "Job#id=#{id}. Attempt to run non-enqueued job aborted. It was either cancelled or run without being enqueued."
    raise
  end

  def frequency
    interval_value.send(interval_unit) unless on_demand?
  end

  def enable!
    ensure_next_run_is_in_the_future
    self.enabled = true
    save!
  end

  def disable
    update_attribute(:enabled, false)
  end

  def next_task_index
    (job_tasks.last.try(:index) || 0) + 1
  end

  def compact_indices
    job_tasks.each_with_index do |task, index|
      task.update_attribute(:index, index + 1)
    end
  end

  def reorder_tasks(ids)
    index = 1
    ids.each do |id|
      task = job_tasks.all.find { |task| task.id == id }
      if task
        task.update_attribute(:index, index)
        index += 1
      end
    end
  end

  def kill
    job_tasks.map(&:kill)
    update_attribute(:status, STOPPING)
  end

  def notify_on(condition, user)
    subscription = job_subscriptions.find_or_create_by_user_id_and_condition(user.id, condition)
    subscription.update_attributes!(:condition => condition, :user => user)
    reload
  end

  def dont_notify_on(condition, user)
    subscription = job_subscriptions.find_by_user_id_and_condition(user.id, condition)
    subscription.delete
    reload
  end

  def subscribe_recipients(options)
    job_subscriptions.destroy_all
    options[:success_recipients].each { |id| notify_on(:success, workspace.members.find(id)) } if options[:success_recipients]
    options[:failure_recipients].each { |id| notify_on(:failure, workspace.members.find(id)) } if options[:failure_recipients]
  end

  def reset_ownership!
    self.owner = workspace.owner
    save!
  end

  def idle
    update_attribute(:status, IDLE)
  end

  private

  def initialize_results
    @tasks_results = []
    @result = job_results.create(:started_at => last_run)
  end

  def prepare_to_run!
    ensure_next_run_is_in_the_future
    self.last_run = Time.current
    self.disable if expiring?
    self.status = RUNNING
    save!
  end

  def ensure_next_run_is_in_the_future
    if next_run
      while next_run < Time.current
        increment_next_run
      end
    end
  end

  def increment_next_run
    self.next_run = frequency.since(next_run)
  end

  def next_run_not_in_past
    errors.add(:job, :NEXT_RUN_IN_PAST) if (!on_demand? && next_run < 1.minutes.ago)
  end

  def end_run_not_in_past
    errors.add(:job, :END_RUN_IN_PAST) if (!on_demand? && end_run < 1.minutes.ago)
  end

  def finalize_results_and_event(event_class)
    @result.update_attributes(:succeeded => event_class.succeeded, :finished_at => Time.current)
    @result.job_task_results << @tasks_results
    event_class.by(owner).add(:job => self, :workspace => workspace, :job_result => @result)
    idle
  end

  def perform_tasks
    job_tasks.each(&:idle!)

    job_tasks.each do |task|
      task_result = task.perform
      @tasks_results << task_result

      raise JobTask::JobTaskFailure.new if task_result.status == JobTaskResult::FAILURE
    end
  end

  def on_demand?
    interval_unit == 'on_demand'
  end

  def expiring?
    on_demand? ? false : (end_run && next_run > end_run.to_date)
  end

  def enqueued?
    status == ENQUEUED
  end

  def owner_can_edit
    errors.add(:owner, :JOB_OWNER_MEMBERSHIP_REQUIRED) unless (owner.admin? || workspace.members.include?(owner))
  end

  def create_job_created_event
    Events::JobCreated.by(current_user).add(
        :job => self,
        :workspace => workspace,
    )
  end

  def create_job_deleted_event
    Events::JobDeleted.by(current_user).add(
        :job => self,
        :workspace => workspace,
    )
  end

end
