require 'spec_helper'

describe SchemasController do
  ignore_authorization!

  let(:user) { FactoryGirl.create :user }

  before do
    log_in user
  end

  context "#index" do
    let(:gpdb_instance) { FactoryGirl.create(:gpdb_instance, :owner_id => user.id) }
    let(:instanceAccount) { FactoryGirl.create(:instance_account, :gpdb_instance_id => gpdb_instance.id, :owner_id => user.id) }
    let(:database) { FactoryGirl.create(:gpdb_database, :gpdb_instance => gpdb_instance, :name => "test2") }
    let(:schema1) { FactoryGirl.build(:gpdb_schema, :name => 'schema1', :database => database) }
    let(:schema2) { FactoryGirl.build(:gpdb_schema, :name => 'schema2', :database => database) }

    before do
      FactoryGirl.create(:gpdb_table, :name => "table1", :schema => schema1)
      FactoryGirl.create(:gpdb_view, :name => "view1", :schema => schema1)
      schema1.reload

      FactoryGirl.create(:gpdb_table, :name => "table2", :schema => schema2)
      schema2.reload

      stub(GpdbSchema).refresh(instanceAccount, database) { [schema1, schema2] }
    end

    it "uses authorization" do
      mock(subject).authorize!(:show_contents, gpdb_instance)
      get :index, :database_id => database.to_param
    end

    it "should retrieve all schemas for a database" do
      get :index, :database_id => database.to_param

      response.code.should == "200"
      decoded_response.should have(2).items

      decoded_response[0].name.should == "schema1"
      decoded_response[0].database.instance.id.should == gpdb_instance.id
      decoded_response[0].database.name.should == "test2"
      decoded_response[0].dataset_count.should == 2

      decoded_response[1].name.should == "schema2"
      decoded_response[1].database.instance.id.should == gpdb_instance.id
      decoded_response[1].database.name.should == "test2"
      decoded_response[1].dataset_count.should == 1
    end

    generate_fixture "schemaSet.json" do
      get :index, :database_id => database.to_param
    end
  end

  context "#show" do
    let(:schema) { FactoryGirl.create(:gpdb_schema) }
    before do
      any_instance_of(GpdbSchema) { |schema| stub(schema).verify_in_source }
    end

    it "uses authorization" do
      mock(subject).authorize!(:show_contents, schema.gpdb_instance)
      get :show, :id => schema.to_param
    end

    it "renders the schema" do
      get :show, :id => schema.to_param
      response.code.should == "200"
      decoded_response.id.should == schema.id
    end

    it "verifies the schema exists" do
      mock.proxy(GpdbSchema).find_and_verify_in_source(schema.id.to_s, user)
      get :show, :id => schema.to_param
      response.code.should == "200"
    end

    context "when the schema can't be found" do
      it "returns 404" do
        get :show, :id => "-1"
        response.code.should == "404"
      end
    end

    generate_fixture "schema.json" do
      get :show, :id => schema.to_param
    end

    context "when the schema is not in GPDB" do
      it "should raise an error" do
        stub(GpdbSchema).find_and_verify_in_source(schema.id.to_s, user) { raise ActiveRecord::RecordNotFound.new }

        get :show, :id => schema.to_param

        response.code.should == "404"
      end
    end
  end
end
