const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

// Initialize the S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

// Function to retrieve data from S3
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

// Function to retrieve today's data
const retrieveTodaysData = async () => {
  const bucketName = process.env.S3_BUCKET_NAME;  // S3 bucket name from environment variable
  const date = new Date().toISOString().split("T")[0];  // YYYY-MM-DD
  const key = `${process.env.S3_FILE_PREFIX}/${date}/data.json`;  // S3 file path

  return await retrieveDataFromS3(bucketName, key);
};

// Lambda handler function
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

exports.handler = handler;

module.exports = {
  handler,
  retrieveDataFromS3,
  retrieveTodaysData
};