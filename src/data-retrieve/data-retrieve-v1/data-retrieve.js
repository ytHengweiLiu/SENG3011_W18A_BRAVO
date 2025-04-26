/**
 * @module data-retrieve
 * @description Module for retrieving NBA team statistics from AWS S3
 */

const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

/**
 * Initialize the S3 client
 * @type {S3Client}
 */
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

/**
 * Retrieves data from an S3 bucket
 * @async
 * @function retrieveDataFromS3
 * @param {string} bucketName - The name of the S3 bucket
 * @param {string} key - The S3 object key (path)
 * @throws {Error} If retrieval fails
 * @returns {Promise<Object>} The retrieved JSON data
 */
const retrieveDataFromS3 = async (bucketName, key) => {
  try {
    const params = {
      Bucket: bucketName,
      Key: key,
    };

    // Get the object from S3
    const command = new GetObjectCommand(params);
    const response = await s3Client.send(command);

    // Convert the response body to a string
    const data = await response.Body.transformToString();

    // Parse the JSON data
    const jsonData = JSON.parse(data);

    if (!(jsonData.data_source && jsonData.dataset_type && jsonData.events)) {
      console.error("Error: Data not in ADAGE 3.0 format");
    }
    return jsonData;
  } catch (error) {
    console.error("Error retrieving data from S3:", error);
    throw error;
  }
};

/**
 * Retrieves the current day's NBA team statistics data from S3
 * @async
 * @function retrieveTodaysData
 * @throws {Error} If retrieval fails
 * @returns {Promise<Object>} Today's NBA team statistics data
 */
const retrieveTodaysData = async () => {
  const bucketName = process.env.S3_BUCKET_NAME;  // S3 bucket name from environment variable
  const date = new Date().toISOString().split("T")[0];  // YYYY-MM-DD
  const key = `${process.env.S3_FILE_PREFIX}/${date}/data.json`;  // S3 file path

  return await retrieveDataFromS3(bucketName, key);
};

/**
 * AWS Lambda handler function
 * @async
 * @function handler
 * @returns {Promise<Object>} Lambda response object with status code and data
 */
const handler = async () => {
  try {
    // Retrieve the latest data from S3
    const data = await retrieveTodaysData();

    // Return the data with CORS headers
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",  // Allow all origins
        "Access-Control-Allow-Methods": "GET,OPTIONS",  // Allowed methods
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",  // Allowed headers
      },
      body: JSON.stringify(data),  // Return the retrieved data
    };
  } catch (error) {
    console.error("Error:", error);

    // Return an error response with CORS headers
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      },
      body: JSON.stringify({
        error: "Failed to retrieve data from S3.",
        details: error.message,
      }),
    };
  }
};

module.exports = {
  handler,
  retrieveDataFromS3,
  retrieveTodaysData
};