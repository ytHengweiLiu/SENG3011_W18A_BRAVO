const axios = require("axios");
const cheerio = require("cheerio");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// Initialize the S3 client
const s3Client = new S3Client({
  region: "us-east-1",
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

    const jsonData = { data: tableRows };

    // Upload to S3
    await uploadToS3(jsonData, process.env.S3_BUCKET_NAME);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Data scraped and uploaded to S3 successfully." }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to scrape data or upload to S3.",
        details: error.message,
      }),
    };
  }
};

// Function to upload JSON data to S3
const uploadToS3 = async (jsonData, bucketName) => {
  try {
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const key = `nba-stats/${date}/data.json`;

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
exports.handler = async (event) => {
  return await scrapeData();
};