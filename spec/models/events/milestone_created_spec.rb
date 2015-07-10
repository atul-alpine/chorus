require 'spec_helper'
require_relative 'helpers'

describe Events::MilestoneCreated do
  extend EventHelpers

  let(:milestone) { milestones(:default) }
  let(:actor) { users(:owner) }
  let(:workspace) { workspaces(:public) }

   subject do
     Events::MilestoneCreated.add(
        :actor => actor,
        :milestone => milestone,
        :workspace => workspace
    )
   end

  its(:action) { should == "MilestoneCreated" }
  its(:targets) { should == {:milestone => milestone} }

  it_creates_activities_for { [actor, milestone, workspace] }

end