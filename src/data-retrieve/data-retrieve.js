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
    return jsonData;
  } catch (error) {
    console.error("Error retrieving data from S3:", error);
    throw error;
  }
};

// Function to retrieve today's data
const retrieveTodaysData = async () => {
  const bucketName = process.env.S3_BUCKET_NAME;
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const key = `${process.env.S3_FILE_PREFIX}/${date}/data.json`; // Use environment variable for file prefix

  return await retrieveDataFromS3(bucketName, key);
};

// Lambda handler function
exports.handler = async (event) => {
  try {
    const data = await retrieveTodaysData();
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to retrieve data from S3.",
        details: error.message,
      }),
    };
  }
};