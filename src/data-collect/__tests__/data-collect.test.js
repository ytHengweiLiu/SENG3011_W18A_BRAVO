const { handler } = require("../data-collect.js");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const axios = require("axios");
// const cheerio = require("cheerio");
const fs = require("fs");
const { mockClient } = require("aws-sdk-client-mock");

// Mock S3 client
const mockS3 = mockClient(S3Client);

// Store original environment variables
const originalEnv = process.env;

// Mock HTML data
const mockHtml = fs.readFileSync("../tests/resources/mock_nba_stats.html", {
  encoding: "utf-8",
  flag: "r",
});

describe("NBA Stats Scraper Lambda Tests", () => {
  // Mock axios and S3 operations
  beforeEach(() => {
    mockS3.reset();
    
    // Mock the environment variables
    process.env = {
      ...originalEnv,
      AWS_REGION: "us-east-1",
      S3_BUCKET_NAME: "test-bucket",
      S3_FILE_PREFIX: "nba-stats",
    };
    
    // Mock axios.get
    jest.spyOn(axios, "get").mockImplementation(() => {
      return Promise.resolve({ data: mockHtml });
    });
  });
  
  afterAll(() => {
    // Restore environment variables
    process.env = originalEnv;
    
    // Restore axios mock
    jest.restoreAllMocks();
  });
  
  it("should successfully scrape data and upload to S3", async () => {
    // Mock successful S3 upload
    mockS3.on(PutObjectCommand).resolves({});
    
    // Execute the handler
    const response = await handler();
    
    // Verify response
    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body)).toEqual({
      message: "Data scraped and uploaded to S3 successfully."
    });
    
    // Verify S3 command was called with correct parameters
    const calls = mockS3.commandCalls(PutObjectCommand);
    expect(calls.length).toBe(1);
    
    // Verify content type is set correctly
    const params = calls[0].args[0];
    expect(params.input.ContentType).toEqual("application/json");
    expect(params.input.Bucket).toEqual("test-bucket");
    
    // Verify key format includes date
    const today = new Date().toISOString().split('T')[0];
    expect(params.input.Key).toEqual(`nba-stats/${today}/data.json`);
    
    // Verify JSON structure
    const uploadedData = JSON.parse(params.input.Body);
    expect(uploadedData).toHaveProperty("data_source", "Yahoo Sports");
    expect(uploadedData).toHaveProperty("dataset_type", "NBA Team Statistics");
    expect(uploadedData).toHaveProperty("events");
    expect(Array.isArray(uploadedData.events)).toBe(true);
  });
  
  it("should handle errors when no table is found on the page", async () => {
    // Mock HTML with no table
    jest.spyOn(axios, "get").mockImplementation(() => {
      return Promise.resolve({ data: "<html><body>No table here</body></html>" });
    });
    
    // Execute the handler
    const response = await handler();
    
    // Verify error response
    expect(response.statusCode).toEqual(500);
    expect(JSON.parse(response.body)).toHaveProperty("error");
    expect(JSON.parse(response.body).details).toContain("No table found on the page");
    
    // Verify S3 was not called
    const calls = mockS3.commandCalls(PutObjectCommand);
    expect(calls.length).toBe(0);
  });
  
  it("should handle axios request errors", async () => {
    // Mock axios error
    jest.spyOn(axios, "get").mockImplementation(() => {
      return Promise.reject(new Error("Network error"));
    });
    
    // Execute the handler
    const response = await handler();
    
    // Verify error response
    expect(response.statusCode).toEqual(500);
    expect(JSON.parse(response.body)).toHaveProperty("error");
    expect(JSON.parse(response.body).details).toContain("Network error");
  });
  
  it("should handle S3 upload errors", async () => {
    // Mock S3 error
    mockS3.on(PutObjectCommand).rejects(new Error("S3 upload failed"));
    
    // Execute the handler
    const response = await handler();
    
    // Verify error response
    expect(response.statusCode).toEqual(500);
    expect(JSON.parse(response.body)).toHaveProperty("error");
    expect(JSON.parse(response.body).details).toContain("S3 upload failed");
  });
});

// Test the uploadToS3 function directly
// describe("S3 Upload Function", () => {
//   // Get the uploadToS3 function - in a real scenario, you would export this function
//   // We need to make the uploadToS3 function accessible for testing
// // For now, we'll mock it based on the implementation in index.js
// const uploadToS3 = async (jsonData, bucketName, key) => {
//   try {
//     const params = {
//       Bucket: bucketName,
//       Key: key,
//       Body: JSON.stringify(jsonData, null, 2),
//       ContentType: "application/json",
//     };

//     const command = new PutObjectCommand(params);
//     await s3Client.send(command);
//   } catch (error) {
//     throw error;
//   }
// };
  
//   beforeEach(() => {
//     mockS3.reset();
//   });
  
//   it("should properly call S3 client with correct parameters", async () => {
//     // Mock successful upload
//     mockS3.on(PutObjectCommand).resolves({});
    
//     // Call the function
//     const testData = { test: "data" };
//     const bucketName = "test-bucket";
//     const key = "test-key";
    
//     await uploadToS3(testData, bucketName, key);
    
//     // Verify S3 was called correctly
//     const calls = mockS3.commandCalls(PutObjectCommand);
//     expect(calls.length).toBe(1);
    
//     const params = calls[0].args[0];
//     expect(params.input.Bucket).toEqual(bucketName);
//     expect(params.input.Key).toEqual(key);
//     expect(params.input.ContentType).toEqual("application/json");
//     expect(JSON.parse(params.input.Body)).toEqual(testData);
//   });
  
//   it("should throw an error when S3 upload fails", async () => {
//     // Mock failed upload
//     mockS3.on(PutObjectCommand).rejects(new Error("Upload failed"));
    
//     // Call the function and expect error
//     const testData = { test: "data" };
//     const bucketName = "test-bucket";
//     const key = "test-key";
    
//     await expect(uploadToS3(testData, bucketName, key)).rejects.toThrow("Upload failed");
//   });
// });

// // Test the scrapeData function for data processing
// describe("Data Processing", () => {
//   // Get the scrapeData function - in a real scenario, you would export this function
//   // Since scrapeData isn't exported, we'll test through the handler function
// // which calls scrapeData internally
  
//   beforeEach(() => {
//     mockS3.reset();
//     mockS3.on(PutObjectCommand).resolves({});
    
//     process.env = {
//       ...originalEnv,
//       AWS_REGION: "us-east-1",
//       S3_BUCKET_NAME: "test-bucket",
//       S3_FILE_PREFIX: "nba-stats",
//     };
//   });
  
//   it("should correctly parse table data", async () => {
//     // Create a mock HTML with a simple table structure
//     const sampleHtml = `
//       <table>
//         <thead>
//           <tr>
//             <th>Team</th>
//             <th>GP</th>
//             <th>PPG</th>
//           </tr>
//         </thead>
//         <tbody>
//           <tr>
//             <td>Lakers</td>
//             <td>82</td>
//             <td>110.5</td>
//           </tr>
//           <tr>
//             <td>Celtics</td>
//             <td>82</td>
//             <td>115.2</td>
//           </tr>
//         </tbody>
//       </table>
//     `;
    
//     // Mock axios.get to return our sample HTML
//     jest.spyOn(axios, "get").mockImplementation(() => {
//       return Promise.resolve({ data: sampleHtml });
//     });
    
//     // Execute the scrapeData function
//     const response = await scrapeData();
    
//     // Get the data that was passed to S3
//     const calls = mockS3.commandCalls(PutObjectCommand);
//     const uploadedData = JSON.parse(calls[0].args[0].input.Body);
    
//     // Verify data structure and parsing
//     expect(uploadedData.events.length).toBe(2);
    
//     // Check first team data
//     expect(uploadedData.events[0].attributes).toHaveProperty("Team", "Lakers");
//     expect(uploadedData.events[0].attributes).toHaveProperty("GP", "82");
//     expect(uploadedData.events[0].attributes).toHaveProperty("PPG", "110.5");
    
//     // Check second team data
//     expect(uploadedData.events[1].attributes).toHaveProperty("Team", "Celtics");
//     expect(uploadedData.events[1].attributes).toHaveProperty("GP", "82");
//     expect(uploadedData.events[1].attributes).toHaveProperty("PPG", "115.2");
//   });

// });
