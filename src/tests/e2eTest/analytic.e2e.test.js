const axios = require("axios");

const ANALYSE_API_URL = "https://1gz0wm5412.execute-api.us-east-1.amazonaws.com/prod/analyse";

const TEAM_1 = "LA Lakers";
const TEAM_2 = "Washington";

describe("E2E Test for Analyse API", () => {
  test("Successfully analyse the data", async () => {
    const requestBody = { team1: TEAM_1, team2: TEAM_2 };

    const response = await axios.post(ANALYSE_API_URL, requestBody, {
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status).toBe(200);

    const data = response.data;

    expect(data).toHaveProperty("analysis");
    expect(data.analysis).toHaveProperty("winProbabilities");
    expect(data.analysis.winProbabilities).toHaveProperty(TEAM_1);
    expect(data.analysis.winProbabilities).toHaveProperty(TEAM_2);

    const prob1 = data.analysis.winProbabilities[TEAM_1];
    const prob2 = data.analysis.winProbabilities[TEAM_2];

    expect(prob1).toBeGreaterThanOrEqual(0);
    expect(prob1).toBeLessThanOrEqual(1);
    expect(prob2).toBeGreaterThanOrEqual(0);
    expect(prob2).toBeLessThanOrEqual(1);
    expect(prob1 + prob2).toBeCloseTo(1, 1);
  }, 50000);

  test("Analyse API returns error for missing parameters", async () => {
    try {
      await axios.post(ANALYSE_API_URL, {}, { headers: { "Content-Type": "application/json" } });
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toBe("Missing parameters");
    }
  });

  test("Analyse API returns error for unknown teams", async () => {
    try {
      await axios.post(ANALYSE_API_URL, { team1: "UnknownTeam", team2: "FakeTeam" }, { headers: { "Content-Type": "application/json" } });
    } catch (error) {
      expect(error.response.status).toBe(404);
      expect(error.response.data.error).toBe("Team data not found");
    }
  });
});
