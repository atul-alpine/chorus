require 'spec_helper'
require_relative 'helpers'

describe Events::MilestoneUpdated do
  extend EventHelpers

  let(:milestone) { milestones(:default) }
  let(:actor) { users(:default) }
  let(:workspace) { workspaces(:public) }


  subject do
    Events::MilestoneUpdated.add(
        :actor => actor,
        :milestone => milestone,
        :workspace => workspace
    )
  end

  its(:action) { should == "MilestoneUpdated" }
  its(:targets) { should == {:milestone => milestone} }

  it_creates_activities_for { [actor, milestone, workspace] }

end