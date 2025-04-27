const axios = require("axios");

describe("E2E Test for Analyse API", () => {
  test("Missing team parameter", async () => {
    const url = "https://1pka1875p6.execute-api.us-east-1.amazonaws.com/default/nba-analyse-lambda-v2?team1=WAS";

    try {
      await axios.get(url);
    } catch (error) {
      const response = error.response;

      expect(response.status).toBe(400);

      const data = response.data;

      expect(data.error).toContain("Missing team1 or team2 abbreviation or home court advantage.");
    }
  });

  test("Invalid Team Name", async () => {
    const url = "https://1pka1875p6.execute-api.us-east-1.amazonaws.com/default/nba-analyse-lambda-v2?team1=WAsS&team2=BOS&home=0";

    try {
      await axios.get(url);
    } catch (error) {
      const response = error.response;

      expect(response.status).toBe(500);

      const data = response.data;

      expect(data.error).toContain("An error occurred (NoSuchKey) when calling the GetObject operation: The specified key does not exist.");
    }
  });

  test("Invalid Home Court Advantage Value", async () => {
    const url = "https://1pka1875p6.execute-api.us-east-1.amazonaws.com/default/nba-analyse-lambda-v2?team1=WAS&team2=BOS&home=9";

    try {
      await axios.get(url);
    } catch (error) {
      const response = error.response;

      expect(response.status).toBe(400);

      const data = response.data;

      expect(data.error).toContain("home court advantage can only be 0 or 1.");
    }
  });

  test("Successfully analyse the data", async () => {
    const url = "https://1pka1875p6.execute-api.us-east-1.amazonaws.com/default/nba-analyse-lambda-v2?team1=WAS&team2=BOS&home=0"
    const response = await axios.get(url);

    expect(response.status).toBe(200);

    const data = response.data;
    
    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("winning_rate");
    expect(data).toHaveProperty("prediction");
    expect(data).toHaveProperty("model_accuracy");
    expect(data).toHaveProperty("input_features");
  }, 10000);

});
