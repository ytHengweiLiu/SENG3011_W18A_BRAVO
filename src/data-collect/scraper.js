const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
require("dotenv").config({ path: `${__dirname}/../../.env` });

// Validate environment variables
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("Missing AWS credentials in environment variables.");
}

if (!process.env.S3_BUCKET_NAME) {
    throw new Error("Missing S3_BUCKET_NAME in environment variables.");
}

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

        // Write file synchronously to avoid race conditions
        const filePath = path.join(__dirname, "data.json");
        fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
        console.log("Success: Data saved to data.json");

        // Upload to S3
        await uploadToS3("data.json", process.env.S3_BUCKET_NAME);

        return jsonData;
    } catch (error) {
        if (error.response) {
            console.error(`HTTP Error ${error.response.status}: ${error.response.statusText}`);
        } else {
            console.error("Network Error:", error.message);
        }
        throw error;
    }
};

// Function to upload a file to S3
const uploadToS3 = async (filePath, bucketName) => {
    try {
        const fileContent = fs.readFileSync(filePath);

        const params = {
            Bucket: bucketName,
            Key: `nba-stats/data.json`, 
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

module.exports = scrapeData;