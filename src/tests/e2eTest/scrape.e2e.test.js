// This test suite only includes success tests since the Lambda function doesn't take any input.

const axios = require("axios");
require("dotenv").config();
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const API_URL = "https://1gz0wm5412.execute-api.us-east-1.amazonaws.com/prod/scrape";
const S3_BUCKET_NAME = "nba-prediction-bucket-seng3011";
const S3_FILE_PREFIX = "nba-stats";
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const getS3Object = async (key) => {
  try {
    const command = new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key });
    const response = await s3Client.send(command);
    
    const streamToString = (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        stream.on("error", reject);
      });

    return streamToString(response.Body);
  } catch (error) {
    console.error("Error fetching S3 object:", error);
    throw error;
  }
};

describe("E2E Test for DATA COLLECTION", () => {
  let s3Key;

  test("API Gateway triggers Lambda successfully", async () => {
    const response = await axios.get(API_URL);
    
    expect(response.status).toBe(200);
    expect(response.data.message).toContain("Data scraped and uploaded to S3");

    const today = new Date().toISOString().split('T')[0];
    s3Key = `${S3_FILE_PREFIX}/${today}/data.json`;
  }, 50000);

  test("S3 file is uploaded successfully", async () => {
    const fileContent = await getS3Object(s3Key);
    const jsonData = JSON.parse(fileContent);

    expect(jsonData).toHaveProperty("data_source", "Yahoo Sports");
    expect(jsonData).toHaveProperty("dataset_type", "NBA Team Statistics");
    expect(jsonData).toHaveProperty("events");
    expect(jsonData.events.length).toBeGreaterThan(0);
  }, 50000);
});
