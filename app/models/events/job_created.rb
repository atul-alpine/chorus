require 'events/base'

module Events
  class JobCreated < Base
    has_targets :job
    has_activities :actor, :job , :workspace
  end
end
