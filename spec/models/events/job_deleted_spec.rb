require 'spec_helper'
require_relative 'helpers'

describe Events::JobDeleted do
  extend EventHelpers

  let(:job) { jobs(:default) }
  let(:actor) { users(:owner) }
  let(:workspace) { workspaces(:public) }

  subject do
    Events::JobDeleted.add(
        :actor => actor,
        :job => job,
        :workspace => workspace
    )
  end

  its(:action) { should == "JobDeleted" }
  its(:targets) { should == {:job => job} }

  it_creates_activities_for { [actor, job, workspace] }

end