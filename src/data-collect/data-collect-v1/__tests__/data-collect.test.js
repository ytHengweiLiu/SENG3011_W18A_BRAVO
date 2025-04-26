const { handler } = require('../data-collect.js')
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3')
const axios = require('axios')
const fs = require('fs')
const { mockClient } = require('aws-sdk-client-mock')

// Mock S3 client
const mockS3 = mockClient(S3Client)

// Store original environment variables
const originalEnv = process.env

// Mock HTML data
const mockHtml = fs.readFileSync('../tests/resources/mock_nba_stats.html', {
  encoding: 'utf-8',
  flag: 'r'
})

describe('NBA Stats Scraper Lambda Tests', () => {
  // Mock axios and S3 operations
  beforeEach(() => {
    mockS3.reset()

    // Mock the environment variables
    process.env = {
      ...originalEnv,
      AWS_REGION: 'us-east-1',
      S3_BUCKET_NAME: 'test-bucket',
      S3_FILE_PREFIX: 'nba-stats'
    }

    // Mock axios.get
    jest.spyOn(axios, 'get').mockImplementation(() => {
      return Promise.resolve({ data: mockHtml })
    })
  })

  afterAll(() => {
    // Restore environment variables
    process.env = originalEnv

    // Restore axios mock
    jest.restoreAllMocks()
  })

  it('should successfully scrape data and upload to S3', async () => {
    // Mock successful S3 upload
    mockS3.on(PutObjectCommand).resolves({})

    // Execute the handler
    const response = await handler()

    // Verify response
    expect(response.statusCode).toEqual(200)
    expect(JSON.parse(response.body)).toEqual({
      message: 'Data scraped and uploaded to S3 successfully.'
    })

    // Verify S3 command was called with correct parameters
    const calls = mockS3.commandCalls(PutObjectCommand)
    expect(calls.length).toBe(1)

    // Verify content type is set correctly
    const params = calls[0].args[0]
    expect(params.input.ContentType).toEqual('application/json')
    expect(params.input.Bucket).toEqual('test-bucket')

    // Verify key format includes date
    const today = new Date().toISOString().split('T')[0]
    expect(params.input.Key).toEqual(`nba-stats/${today}/data.json`)

    // Verify JSON structure
    const uploadedData = JSON.parse(params.input.Body)
    expect(uploadedData).toHaveProperty('data_source', 'Yahoo Sports')
    expect(uploadedData).toHaveProperty('dataset_type', 'NBA Team Statistics')
    expect(uploadedData).toHaveProperty('events')
    expect(Array.isArray(uploadedData.events)).toBe(true)
  })

  it('should handle errors when no table is found on the page', async () => {
    // Mock HTML with no table
    jest.spyOn(axios, 'get').mockImplementation(() => {
      return Promise.resolve({
        data: '<html><body>No table here</body></html>'
      })
    })

    // Execute the handler
    const response = await handler()

    // Verify error response
    expect(response.statusCode).toEqual(500)
    expect(JSON.parse(response.body)).toHaveProperty('error')
    expect(JSON.parse(response.body).details).toContain(
      'No table found on the page'
    )

    // Verify S3 was not called
    const calls = mockS3.commandCalls(PutObjectCommand)
    expect(calls.length).toBe(0)
  })

  it('should handle axios request errors', async () => {
    // Mock axios error
    jest.spyOn(axios, 'get').mockImplementation(() => {
      return Promise.reject(new Error('Network error'))
    })

    // Execute the handler
    const response = await handler()

    // Verify error response
    expect(response.statusCode).toEqual(500)
    expect(JSON.parse(response.body)).toHaveProperty('error')
    expect(JSON.parse(response.body).details).toContain('Network error')
  })

  it('should handle S3 upload errors', async () => {
    // Mock S3 error
    mockS3.on(PutObjectCommand).rejects(new Error('S3 upload failed'))

    // Execute the handler
    const response = await handler()

    // Verify error response
    expect(response.statusCode).toEqual(500)
    expect(JSON.parse(response.body)).toHaveProperty('error')
    expect(JSON.parse(response.body).details).toContain('S3 upload failed')
  })
})
