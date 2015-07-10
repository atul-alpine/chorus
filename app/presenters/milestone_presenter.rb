class MilestonePresenter < Presenter

  def to_hash
   milestone =  {
      :id => model.id,
      :workspace => present(model.workspace, options.merge(:succinct => options[:succinct] || options[:list_view])),
      :name => model.name,
      :target_date => model.target_date,
      :state => model.state
    }

   unless rendering_activities? || succinct?
   milestone.merge!({
        :name => model.name
    })
   end

    milestone
  end

  def complete_json?
    !rendering_activities? && !succinct?
  end

end
