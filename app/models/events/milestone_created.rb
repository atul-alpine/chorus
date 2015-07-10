require 'events/base'

module Events
  class MilestoneCreated < Base
    has_targets :milestone
    has_activities :actor, :milestone, :workspace
  end
end
