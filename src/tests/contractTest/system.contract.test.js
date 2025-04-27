const axios = require("axios");

const COLLECTION_URL = "https://yetriidc3m.execute-api.us-east-1.amazonaws.com/default/nba-collection-lambda-v2?team1=WAS&team2=BOS"
const RETREIVE_URL = "https://4keygboi7k.execute-api.us-east-1.amazonaws.com/default/nba-retrieve-lambda-v2?team1=WAS&team2=BOS"
const ANALYSE_URL = "https://1pka1875p6.execute-api.us-east-1.amazonaws.com/default/nba-analyse-lambda-v2?team1=WAS&team2=BOS&home=0"


describe("System contract test", () => {
  test("Successful Workflow", async () => {
    const collection_response = await axios.get(COLLECTION_URL);

    expect(collection_response.status).toBe(200);

    const collection_data = collection_response.data;
    
    expect(collection_data).toHaveProperty("message");
    expect(collection_data.message).toContain("Successfully uploaded!");

    expect(collection_data).toHaveProperty("object_key");


    const retrieve_response = await axios.get(RETREIVE_URL);

    expect(retrieve_response.status).toBe(200);

    const retrieve_data = retrieve_response.data;
    
    expect(retrieve_data).toHaveProperty("stats");
        
    
    const analyse_response = await axios.get(ANALYSE_URL);

    expect(analyse_response.status).toBe(200);

    const analyse_data = analyse_response.data;
    
    expect(analyse_data).toHaveProperty("timestamp");
    expect(analyse_data).toHaveProperty("winning_rate");
    expect(analyse_data).toHaveProperty("prediction");
    expect(analyse_data).toHaveProperty("model_accuracy");
    expect(analyse_data).toHaveProperty("input_features");
  }, 20000);
});
