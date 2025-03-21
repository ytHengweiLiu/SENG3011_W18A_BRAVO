const axios = require("axios");
const cheerio = require("cheerio");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// Initialize the S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

const scrapeData = async () => {
  const url = "https://sports.yahoo.com/nba/stats/team/";

  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const table = $("table").first();
    if (!table.length) {
      throw new Error("Error: No table found on the page.");
    }

    let tableHeaders = [];
    let tableRows = [];

    table.find("thead tr").each((index, element) => {
      tableHeaders = $(element)
        .find("th")
        .map((i, th) => $(th).text().trim())
        .get();
    });

    table.find("tbody tr").each((index, element) => {
      const row = $(element)
        .find("td")
        .map((i, td) => $(td).text().trim().replace(/\s+/g, " "))
        .get();

      if (row.length > 0) {
        let rowObject = { attributes: {} };
        tableHeaders.forEach((header, i) => {
          rowObject.attributes[header] = row[i] || "";
        });
        tableRows.push(rowObject);
      }
    });

    // ADAGE 3.0 data model format
    const now = new Date()
    const dateString = now.toISOString().split('T')[0] // YYYY-MM-DD
    const timestamp = now.toISOString()

    const jsonData = {
      data_source: 'Yahoo Sports',
      dataset_type: 'NBA Team Statistics',
      dataset_id: `${process.env.S3_BUCKET_NAME}/${process.env.S3_FILE_PREFIX}/${dateString}/data.json`,
      time_object: {
        timestamp: timestamp,
        timezone: 'UTC'
      },
      events: tableRows.map(team => ({
        time_object: {
          timestamp: timestamp,
          duration: 1,
          duration_unit: 'day',
          timezone: 'UTC'
        },
        event_type: 'team_statistics',
        attributes: team.attributes || team
      }))
    }

    // Upload to S3
    const key = `${process.env.S3_FILE_PREFIX}/${dateString}/data.json`;
    await uploadToS3(jsonData, process.env.S3_BUCKET_NAME, key);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      },
      body: JSON.stringify({ message: "Data scraped and uploaded to S3 successfully." }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      },
      body: JSON.stringify({ error: "Failed to scrape data or upload to S3.", details: error.message }),
    };
  }
};

// Function to upload JSON data to S3
const uploadToS3 = async (jsonData, bucketName, key) => {
  try {
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify(jsonData, null, 2),
      ContentType: "application/json",
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    console.log(`Success: File uploaded to S3 at s3://${bucketName}/${key}`);
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw error;
  }
};

// Lambda handler function
const handler = async () => {
  return await scrapeData();
};

exports.handler = handler;

module.exports = {
  handler,
  uploadToS3,
  scrapeData
};
