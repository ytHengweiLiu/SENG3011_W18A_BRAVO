const axios = require("axios");

describe("E2E Test for Collection API", () => {
  test("Missing team parameter", async () => {
    const url = "https://yetriidc3m.execute-api.us-east-1.amazonaws.com/default/nba-collection-lambda-v2?team1=GSW&team2=";

    try {
      await axios.get(url);
    } catch (error) {
      const response = error.response;

      expect(response.status).toBe(400);

      const data = response.data;

      expect(data.error).toContain("Missing team1 or team2 abbreviation.");
    }
  });

  test("Invalid Team Name", async () => {
    const url = "https://yetriidc3m.execute-api.us-east-1.amazonaws.com/default/nba-collection-lambda-v2?team1=GSW&team2=CLEE";

    try {
      await axios.get(url);
    } catch (error) {
      const response = error.response;

      expect(response.status).toBe(404);

      const data = response.data;

      expect(data.error).toContain("Invalid team abbreviation provided.");
    }
  });

  test("Successfully collect the data", async () => {
    const url = "https://yetriidc3m.execute-api.us-east-1.amazonaws.com/default/nba-collection-lambda-v2?team1=GSW&team2=CLE"
    const response = await axios.get(url);

    expect(response.status).toBe(200);

    const data = response.data;
    
    expect(data).toHaveProperty("message");
    expect(data.message).toContain("Successfully uploaded!");

    expect(data).toHaveProperty("object_key");
  }, 10000);
});
