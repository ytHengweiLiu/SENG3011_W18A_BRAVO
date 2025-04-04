// This test suite only includes success tests since the Lambda function doesn't take any input.

const axios = require("axios");

const COLLECT_API_URL = "https://1gz0wm5412.execute-api.us-east-1.amazonaws.com/prod/scrape";
const RETRIEVE_API_URL = "https://1gz0wm5412.execute-api.us-east-1.amazonaws.com/prod/retrieve";

describe("E2E Test for DATA RETRIEVE", () => {
  test("S3 file is retrieved successfully", async () => {
    const scrape_response = await axios.get(COLLECT_API_URL);
    
    expect(scrape_response.status).toBe(200);
    expect(scrape_response.data.message).toContain("Data scraped and uploaded to S3");


    const retrieve_response = await axios.get(RETRIEVE_API_URL);

    expect(retrieve_response.status).toBe(200);
    const retrievedData = retrieve_response.data;
    expect(retrievedData).toHaveProperty("data_source", "Yahoo Sports");
    expect(retrievedData).toHaveProperty("dataset_type", "NBA Team Statistics");
    expect(retrievedData.events.length).toBeGreaterThan(0);
  }, 50000);
});
