const axios = require("axios");

describe("E2E Test for Retrieve API", () => {
  test("Missing team parameter", async () => {
    const url = "https://4keygboi7k.execute-api.us-east-1.amazonaws.com/default/nba-retrieve-lambda-v2?team1=BOS";

    try {
      await axios.get(url);
    } catch (error) {
      const response = error.response;

      expect(response.status).toBe(400);

      const data = response.data;

      expect(data.error).toContain("Missing team1 or team2 abbreviation");
    }
  });

  test("Invalid Team Name", async () => {
    const url = "https://4keygboi7k.execute-api.us-east-1.amazonaws.com/default/nba-retrieve-lambda-v2?team1=BOS&team2=AAA";

    try {
      await axios.get(url);
    } catch (error) {
      const response = error.response;

      expect(response.status).toBe(500);

      const data = response.data;

      expect(data.error).toContain("An error occurred (NoSuchKey) when calling the GetObject operation: The specified key does not exist.");
    }
  });

  test("Successfully retrieve the data", async () => {
    const url = "https://4keygboi7k.execute-api.us-east-1.amazonaws.com/default/nba-retrieve-lambda-v2?team1=BOS&team2=CLE"
    const response = await axios.get(url);

    expect(response.status).toBe(200);

    const data = response.data;
    
    expect(data).toHaveProperty("stats");
  }, 10000);

});
