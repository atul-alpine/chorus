require 'spec_helper'

describe Milestone do
  let(:milestone) { milestones(:public) }
  let(:workspace) { workspaces(:public) }
  let(:params) { {:name => 'cool milestone', :target_date => '2020-07-30T14:00:00-07:00'} }
  let(:actor) { users(:owner) }

  describe "create" do
    it "updates the workspace's target date" do
      expect {
        workspace.milestones.create(params)
        workspace.reload
      }.to change(workspace, :project_target_date).to(Date.parse(params[:target_date]))
    end

    it "creates activity after user creates a milestone" do
      expect do
        Events::MilestoneCreated.add(
            :actor => actor,
            :milestone => milestone,
            :workspace => workspace,
        )
      end
    end

  end

  describe "destroy" do
    context "deleting the milestone with the target date" do
      let(:last_date) { workspace.project_target_date }
      let(:last_ms) { workspace.milestones.order(:target_date).last }
      let(:dates) { workspace.milestones.order(:target_date).map(&:target_date) }

      it "updates its workspace's project target date" do
        expect {
          last_ms.destroy
          workspace.reload
        }.to change(workspace, :project_target_date).from(last_date).to(dates[dates.length-2])
      end
    end
  end


end