const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();

// Initialize the S3 client
const s3Client = new S3Client({
  region: "us-east-1", // Replace with your AWS region
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID, // Use environment variables for credentials
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const scrapeData = async () => {
  const url = "https://sports.yahoo.com/nba/stats/team/";

  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const html = response.data;
    const $ = cheerio.load(html);

    let tableHeaders = [];
    let tableRows = [];

    $("table").first().find("thead tr").each((index, element) => {
      tableHeaders = $(element)
        .find("th")
        .map((i, th) => $(th).text().trim())
        .get();
    });

    $("table").first().find("tbody tr").each((index, element) => {
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

    const jsonData = {
      data: tableRows,
    };

    // Save the data to a local file
    fs.writeFile("data.json", JSON.stringify(jsonData, null, 2), (err) => {
      if (err) {
        console.error("Fail", err);
      } else {
        console.log("Success: Data saved to data.json");
      }
    });

    // Upload the file to S3
    await uploadToS3("data.json", process.env.S3_BUCKET_NAME);

    return jsonData; // Return the scraped data for further use
  } catch (error) {
    console.error("Error:", error.response ? error.response.status : error.message);
    throw error; // Throw the error to handle it in the calling function
  }
};

// Function to upload a file to S3
const uploadToS3 = async (filePath, bucketName) => {
  try {
    const fileContent = fs.readFileSync(filePath);

    const params = {
      Bucket: bucketName,
      Key: `nba-stats/data.json`, // Specify the S3 key (path) where the file will be stored
      Body: fileContent,
      ContentType: "application/json",
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    console.log(`Success: File uploaded to S3 at s3://${bucketName}/nba-stats/data.json`);
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw error;
  }
};

module.exports = scrapeData; // Export the scraper function

