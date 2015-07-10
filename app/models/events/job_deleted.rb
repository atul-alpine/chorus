require 'events/base'

module Events
  class JobDeleted < Base
    has_targets :job
    has_activities :actor, :job , :workspace
  end
end
