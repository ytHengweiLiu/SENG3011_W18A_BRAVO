const { handler } = require('../data-retrieve.js');
const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { mockClient } = require('aws-sdk-client-mock');
// const { Readable } = require('stream');
const { Uint8ArrayBlobAdapter } = require('@smithy/util-stream');

// Mock S3 client
const mockS3 = mockClient(S3Client);

// Store original environment variables
const originalEnv = process.env;

// Sample data in ADAGE 3.0 format
const sampleData = {
  data_source: 'Yahoo Sports',
  dataset_type: 'NBA Team Statistics',
  dataset_id: 'test-bucket/nba-stats/2025-03-21/data.json',
  time_object: {
    timestamp: '2025-03-21T12:00:00Z',
    timezone: 'UTC'
  },
  events: [
    {
      time_object: {
        timestamp: '2025-03-21T12:00:00Z',
        duration: 1,
        duration_unit: 'day',
        timezone: 'UTC'
      },
      event_type: 'team_statistics',
      attributes: {
        Team: 'Boston Celtics',
        GP: '82',
        PPG: '120.5',
        'FG%': '48.9',
        '3P%': '38.8',
        'FT%': '82.3',
        ORPG: '9.8',
        DRPG: '34.5',
        RPG: '44.3',
        APG: '26.8',
        SPG: '7.2',
        BPG: '5.6',
        TOV: '12.7'
      }
    },
    {
      time_object: {
        timestamp: '2025-03-21T12:00:00Z',
        duration: 1,
        duration_unit: 'day',
        timezone: 'UTC'
      },
      event_type: 'team_statistics',
      attributes: {
        Team: 'Indiana Pacers',
        GP: '82',
        PPG: '123.3',
        'FG%': '50.1',
        '3P%': '37.4',
        'FT%': '79.5',
        ORPG: '10.2',
        DRPG: '31.8',
        RPG: '42.0',
        APG: '30.9',
        SPG: '7.0',
        BPG: '5.2',
        TOV: '13.9'
      }
    }
  ]
};

describe('NBA Stats Retrieval Lambda Tests', () => {
  // Mock date to return a fixed value for consistent testing
  const originalDate = global.Date;
  const mockDate = new Date('2025-03-21T12:00:00Z');
  
  beforeEach(() => {
    // Mock Date to return a fixed date for testing
    global.Date = class extends Date {
      constructor() {
        super();
        return mockDate;
      }
      
      static now() {
        return mockDate.getTime();
      }
    };
    
    // Reset S3 mock
    mockS3.reset();
    
    // Mock the environment variables
    process.env = {
      ...originalEnv,
      AWS_REGION: 'us-east-1',
      S3_BUCKET_NAME: 'test-bucket',
      S3_FILE_PREFIX: 'nba-stats',
    };
  });
  
  afterEach(() => {
    // Restore original Date
    global.Date = originalDate;
  });
  
  afterAll(() => {
    // Restore environment variables
    process.env = originalEnv;
  });
  
  it('should successfully retrieve data from S3', async () => {
    // Mock successful S3 retrieval
    mockS3.on(GetObjectCommand).resolves({
      Body: Uint8ArrayBlobAdapter.fromString(JSON.stringify(sampleData))
    });
    
    // Execute the handler
    const response = await handler();
    
    // Verify response
    expect(response.statusCode).toEqual(200);
    
    // Verify S3 command was called with correct parameters
    const calls = mockS3.commandCalls(GetObjectCommand);
    expect(calls.length).toBe(1);
    
    // Verify the key format used the correct date
    const params = calls[0].args[0];
    expect(params.input.Bucket).toEqual('test-bucket');
    expect(params.input.Key).toEqual('nba-stats/2025-03-21/data.json');
    
    // Verify the returned data
    const responseData = JSON.parse(response.body);
    expect(responseData).toEqual(sampleData);
  });
  
  it('should handle S3 retrieval errors', async () => {
    // Mock S3 error
    mockS3.on(GetObjectCommand).rejects(new Error('The specified key does not exist.'));
    
    // Execute the handler
    const response = await handler();
    
    // Verify error response
    expect(response.statusCode).toEqual(500);
    expect(JSON.parse(response.body)).toHaveProperty('error');
    expect(JSON.parse(response.body).details).toContain('The specified key does not exist.');
  });
  
  it('should handle invalid JSON data', async () => {
    // Mock S3 returning invalid JSON
    mockS3.on(GetObjectCommand).resolves({
      Body: Uint8ArrayBlobAdapter.fromString('{"invalid": "json')
    });
    
    // Execute the handler
    const response = await handler();
    
    // Verify error response
    expect(response.statusCode).toEqual(500);
    expect(JSON.parse(response.body)).toHaveProperty('error');
    // Check that it contains an error message about JSON parsing
    expect(JSON.parse(response.body).details).toMatch(/Unterminated string in JSON at position \d+/);
  });
  
  it('should handle non-ADAGE formatted data', async () => {
    // Mock S3 returning data that's not in ADAGE format
    const nonAdageData = { some: 'data', that: 'is not', adage: 'formatted' };
    mockS3.on(GetObjectCommand).resolves({
      Body: Uint8ArrayBlobAdapter.fromString(JSON.stringify(nonAdageData))
    });
    
    // Execute the handler (should still succeed but log an error)
    const response = await handler();
    
    // Because your function doesn't throw an error for non-ADAGE data,
    // it should still return a 200 status code
    expect(response.statusCode).toEqual(200);
    
    // Verify the returned data
    const responseData = JSON.parse(response.body);
    expect(responseData).toEqual(nonAdageData);
    
    // In a real implementation, you might want to validate and reject non-ADAGE data
  });
});

// // Test individual functions
// describe('S3 Data Retrieval Functions', () => {
//   // Extract functions for testing
//   const { retrieveDataFromS3, retrieveTodaysData } = require('../data-retrieve.js');
  
//   // Mock date
//   const originalDate = global.Date;
//   const mockDate = new Date('2025-03-21T12:00:00Z');
  
//   beforeEach(() => {
//     // Mock Date
//     global.Date = class extends Date {
//       constructor() {
//         super();
//         return mockDate;
//       }
      
//       static now() {
//         return mockDate.getTime();
//       }
//     };
    
//     // Reset S3 mock
//     mockS3.reset();
    
//     // Set environment variables
//     process.env = {
//       ...originalEnv,
//       AWS_REGION: 'us-east-1',
//       S3_BUCKET_NAME: 'test-bucket',
//       S3_FILE_PREFIX: 'nba-stats',
//     };
//   });
  
//   afterEach(() => {
//     // Restore Date
//     global.Date = originalDate;
//   });
  
//   it('retrieveDataFromS3 should retrieve and parse data correctly', async () => {
//     // Mock S3 response
//     mockS3.on(GetObjectCommand).resolves({
//       Body: Uint8ArrayBlobAdapter.fromString(JSON.stringify(sampleData))
//     });
    
//     // Call the function
//     const result = await retrieveDataFromS3('test-bucket', 'test-key');
    
//     // Verify S3 was called with correct parameters
//     const calls = mockS3.commandCalls(GetObjectCommand);
//     expect(calls.length).toBe(1);
//     const params = calls[0].args[0];
//     expect(params.input.Bucket).toEqual('test-bucket');
//     expect(params.input.Key).toEqual('test-key');
    
//     // Verify the result
//     expect(result).toEqual(sampleData);
//   });
  
//   it('retrieveDataFromS3 should handle S3 errors', async () => {
//     // Mock S3 error
//     mockS3.on(GetObjectCommand).rejects(new Error('Access denied'));
    
//     // Call the function and expect error
//     await expect(retrieveDataFromS3('test-bucket', 'test-key')).rejects.toThrow('Access denied');
//   });
  
//   it('retrieveTodaysData should call retrieveDataFromS3 with correct parameters', async () => {
//     // Mock retrieveDataFromS3 to verify it's called with correct parameters
//     const mockRetrieveDataFromS3 = jest.fn().mockResolvedValue(sampleData);
    
//     // Create a spy on retrieveDataFromS3
//     const spy = jest.spyOn(require('../data-retrieve.js'), 'retrieveDataFromS3').mockImplementation(mockRetrieveDataFromS3);
    
//     // Call retrieveTodaysData
//     const result = await retrieveTodaysData();
    
//     // Verify retrieveDataFromS3 was called with correct parameters
//     expect(mockRetrieveDataFromS3).toHaveBeenCalledWith('test-bucket', 'nba-stats/2025-03-21/data.json');
    
//     // Verify the result
//     expect(result).toEqual(sampleData);
    
//     // Restore the original function
//     spy.mockRestore();
//   });
// });

// Test error handling in the handler

describe('Handler Error Handling', () => {
  beforeEach(() => {
    // Reset S3 mock
    mockS3.reset();
    
    // Set environment variables
    process.env = {
      ...originalEnv,
      AWS_REGION: 'us-east-1',
      S3_BUCKET_NAME: 'test-bucket',
      S3_FILE_PREFIX: 'nba-stats',
    };
  });
  
  it('should handle errors when environment variables are missing', async () => {
    // Remove required environment variables
    delete process.env.S3_BUCKET_NAME;
    
    // Execute the handler
    const response = await handler();
    
    // Since retrieveTodaysData would try to use undefined as the bucket name,
    // this should result in an error
    expect(response.statusCode).toEqual(500);
    expect(JSON.parse(response.body)).toHaveProperty('error');
  });
  
  it('should include proper CORS headers in error responses', async () => {
    // Mock S3 error
    mockS3.on(GetObjectCommand).rejects(new Error('Test error'));
    
    // Execute the handler
    const response = await handler();
    
    // Verify error response
    expect(response.statusCode).toEqual(500);
    
    // Verify CORS headers
    expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    expect(response.headers).toHaveProperty('Access-Control-Allow-Methods', 'GET,OPTIONS');
    expect(response.headers).toHaveProperty('Access-Control-Allow-Headers');
  });
});
