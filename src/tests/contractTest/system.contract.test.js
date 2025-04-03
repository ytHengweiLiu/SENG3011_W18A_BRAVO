const axios = require("axios");

const COLLECT_API_URL = "https://1gz0wm5412.execute-api.us-east-1.amazonaws.com/prod/scrape";
const RETRIEVE_API_URL = "https://1gz0wm5412.execute-api.us-east-1.amazonaws.com/prod/retrieve";
const ANALYSE_API_URL = "https://1gz0wm5412.execute-api.us-east-1.amazonaws.com/prod/analyse";

const TEAM_1 = "LA Lakers";
const TEAM_2 = "Washington";

describe("System contract test", () => {
    test("Success work flow", async () => {
        const scrape_response = await axios.get(COLLECT_API_URL);
        
        expect(scrape_response.status).toBe(200);
        expect(scrape_response.data.message).toContain("Data scraped and uploaded to S3");

        const retrieve_response = await axios.get(RETRIEVE_API_URL);

        expect(retrieve_response.status).toBe(200);
        const retrievedData = retrieve_response.data;
        expect(retrievedData).toHaveProperty("data_source", "Yahoo Sports");
        expect(retrievedData).toHaveProperty("dataset_type", "NBA Team Statistics");
        expect(retrievedData.events.length).toBeGreaterThan(0);

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
    }, 50000)
})