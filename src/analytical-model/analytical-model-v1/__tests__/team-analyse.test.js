const { handler } = require('../team-analyse.js')
const https = require('https')
const { EventEmitter } = require('events')

// Store original environment variables
const originalEnv = process.env

// Mock sample data
const sampleTeamsData = {
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
        Team: 'Los Angeles Lakers',
        GP: '82',
        PPG: '117.2',
        'FG%': '49.1',
        '3P%': '35.3',
        'FT%': '78.9',
        ORPG: '10.5',
        DRPG: '33.7',
        RPG: '44.2',
        APG: '27.1',
        SPG: '7.8',
        BPG: '5.1',
        TOV: '13.8'
      }
    }
  ]
}

// Mock for the HTTPS module
jest.mock('https', () => {
  const mockRequest = {
    on: jest.fn(),
    end: jest.fn()
  }

  return {
    request: jest.fn(() => mockRequest)
  }
})

describe('Team Analysis Lambda Tests', () => {
  // Mock date to return a fixed value for consistent testing
  const originalDate = global.Date
  const mockDate = new Date('2025-03-21T12:00:00Z')

  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks()

    // Mock Date to return a fixed date for testing
    global.Date = class extends Date {
      constructor () {
        super()
        return mockDate
      }

      static now () {
        return mockDate.getTime()
      }

      toISOString () {
        return '2025-03-21T12:00:00Z'
      }
    }

    // Set environment variables
    process.env = {
      ...originalEnv,
      DATA_RETRIEVAL_API: 'https://example.com/api/retrieve'
    }
  })

  afterEach(() => {
    // Restore original Date
    global.Date = originalDate
  })

  afterAll(() => {
    // Restore environment variables
    process.env = originalEnv
  })

  // Helper function to simulate HTTP responses
  const mockHttpResponse = (responseData, statusCode = 200) => {
    // Create response emitter
    const responseEmitter = new EventEmitter()
    responseEmitter.statusCode = statusCode

    // Mock the https.request implementation
    https.request.mockImplementation((options, callback) => {
      // Simulate immediate response
      setTimeout(() => {
        callback(responseEmitter)

        // Emit data and end events
        if (responseData) {
          responseEmitter.emit('data', JSON.stringify(responseData))
        }
        responseEmitter.emit('end')
      }, 0)

      // Return request mock
      const requestEmitter = new EventEmitter()
      requestEmitter.end = jest.fn()
      return requestEmitter
    })
  }

  // Test successful analysis
  it('should successfully analyse two teams and return win probabilities', async () => {
    // Mock API response
    mockHttpResponse(sampleTeamsData)

    // Call handler with team names
    const event = {
      queryStringParameters: {
        team1: 'Boston Celtics',
        team2: 'Los Angeles Lakers'
      }
    }

    const response = await handler(event)

    // Check status code and response structure
    expect(response.statusCode).toBe(200)

    const responseBody = JSON.parse(response.body)
    expect(responseBody).toHaveProperty('analysis')
    expect(responseBody.analysis).toHaveProperty('winProbabilities')
    expect(responseBody.analysis.winProbabilities).toHaveProperty(
      'Boston Celtics'
    )
    expect(responseBody.analysis.winProbabilities).toHaveProperty(
      'Los Angeles Lakers'
    )

    // Check that probabilities sum to approximately 1
    const celticsProbability =
      responseBody.analysis.winProbabilities['Boston Celtics']
    const lakersProbability =
      responseBody.analysis.winProbabilities['Los Angeles Lakers']
    expect(celticsProbability + lakersProbability).toBeCloseTo(1, 5)

    // Verify timestamp
    expect(responseBody.analysis.analysisTimestamp).toMatch(
      /^2025-03-21T12:00:00/
    )
  })

  // Test handling missing parameters
  it('should return 400 when team parameters are missing', async () => {
    // Call handler without team names
    const event = { queryStringParameters: {} }

    const response = await handler(event)

    // Check error response
    expect(response.statusCode).toBe(400)
    const responseBody = JSON.parse(response.body)
    expect(responseBody).toHaveProperty('error', 'Missing parameters')
  })

  // Test team not found
  it('should return 404 when a team is not found in the data', async () => {
    // Mock API response
    mockHttpResponse(sampleTeamsData)

    // Call handler with a non-existent team
    const event = {
      queryStringParameters: {
        team1: 'Boston Celtics',
        team2: 'Phoenix Suns' // Not in our mock data
      }
    }

    const response = await handler(event)

    // Check error response
    expect(response.statusCode).toBe(404)
    const responseBody = JSON.parse(response.body)
    expect(responseBody).toHaveProperty('error', 'Team data not found')
    expect(responseBody.message).toContain('Phoenix Suns')
  })

  // Test API failure
  it('should handle API request failures', async () => {
    // Create request emitter that will emit an error
    const requestEmitter = new EventEmitter()
    requestEmitter.end = jest.fn()

    // Mock the https.request to return an emitter that will emit an error
    https.request.mockImplementation(() => {
      setTimeout(() => {
        requestEmitter.emit('error', new Error('Network error'))
      }, 0)
      return requestEmitter
    })

    // Call handler
    const event = {
      queryStringParameters: {
        team1: 'Boston Celtics',
        team2: 'Los Angeles Lakers'
      }
    }

    const response = await handler(event)

    // Check error response
    expect(response.statusCode).toBe(500)
    const responseBody = JSON.parse(response.body)
    expect(responseBody).toHaveProperty('error', 'Analysis failed')
  })

  // Test API returning non-200 status
  it('should handle API returning non-200 status', async () => {
    // Mock API response with 500 status
    mockHttpResponse(null, 500)

    // Call handler
    const event = {
      queryStringParameters: {
        team1: 'Boston Celtics',
        team2: 'Los Angeles Lakers'
      }
    }

    const response = await handler(event)

    // Check error response
    expect(response.statusCode).toBe(500)
  })

  // Test API returning invalid JSON
  it('should handle API returning invalid JSON', async () => {
    // Create response emitter
    const responseEmitter = new EventEmitter()
    responseEmitter.statusCode = 200

    // Mock the https.request implementation
    https.request.mockImplementation((options, callback) => {
      // Simulate immediate response
      setTimeout(() => {
        callback(responseEmitter)

        // Emit invalid JSON data and end events
        responseEmitter.emit('data', '{invalid: json}')
        responseEmitter.emit('end')
      }, 0)

      // Return request mock
      const requestEmitter = new EventEmitter()
      requestEmitter.end = jest.fn()
      return requestEmitter
    })

    // Call handler
    const event = {
      queryStringParameters: {
        team1: 'Boston Celtics',
        team2: 'Los Angeles Lakers'
      }
    }

    const response = await handler(event)

    // Check error response
    expect(response.statusCode).toBe(500)
  })

  // Test handling of different event formats
  it('should handle teams provided in the event body (JSON string)', async () => {
    // Mock API response
    mockHttpResponse(sampleTeamsData)

    // Call handler with team names in a JSON string body
    const event = {
      body: JSON.stringify({
        team1: 'Boston Celtics',
        team2: 'Los Angeles Lakers'
      })
    }

    const response = await handler(event)

    // Check status code
    expect(response.statusCode).toBe(200)
  })

  it('should handle teams provided in the event body (parsed JSON object)', async () => {
    // Mock API response
    mockHttpResponse(sampleTeamsData)

    // Call handler with team names in a parsed JSON body
    const event = {
      body: {
        team1: 'Boston Celtics',
        team2: 'Los Angeles Lakers'
      }
    }

    const response = await handler(event)

    // Check status code
    expect(response.statusCode).toBe(200)
  })

  it('should handle teams provided directly in the event object', async () => {
    // Mock API response
    mockHttpResponse(sampleTeamsData)

    // Call handler with team names directly in the event
    const event = {
      team1: 'Boston Celtics',
      team2: 'Los Angeles Lakers'
    }

    const response = await handler(event)

    // Check status code
    expect(response.statusCode).toBe(200)
  })
})

// Test internal helper functions
describe('Team Analysis Helper Functions Tests', () => {
  // Extract functions from the module
  const {
    findTeamData,
    extractTeamStats,
    compareTeamStats,
    calculateWinProbability,
    fetchFromDataRetrievalApi
  } = require('../team-analyse.js')

  // Test findTeamData function
  it('findTeamData should find a team by name (case insensitive)', () => {
    // Call the function
    const bostonTeam = findTeamData(sampleTeamsData, 'boston celtics')

    // Verify result
    expect(bostonTeam).toBeDefined()
    expect(bostonTeam.attributes.Team).toBe('Boston Celtics')

    // Test with exact case
    const lakersTeam = findTeamData(sampleTeamsData, 'Los Angeles Lakers')
    expect(lakersTeam).toBeDefined()
    expect(lakersTeam.attributes.Team).toBe('Los Angeles Lakers')

    // Test with non-existent team
    const nonExistentTeam = findTeamData(sampleTeamsData, 'Chicago Bulls')
    expect(nonExistentTeam).toBeUndefined()
  })

  // Test extractTeamStats function
  it('extractTeamStats should convert string values to numbers', () => {
    const teamData = sampleTeamsData.events[0]

    // Call the function
    const stats = extractTeamStats(teamData)

    // Verify result
    expect(stats.Team).toBe('Boston Celtics')
    expect(stats.PPG).toBe(120.5)
    expect(stats['FG%']).toBe(48.9)
    expect(typeof stats.PPG).toBe('number')

    // Test with invalid input
    expect(extractTeamStats(null)).toBeNull()
    expect(extractTeamStats({})).toBeNull()
  })

  // Test compareTeamStats function
  it('compareTeamStats should calculate differences between team stats', () => {
    const team1Stats = {
      Team: 'Boston Celtics',
      PPG: 120.5,
      RPG: 44.3,
      APG: 26.8,
      SPG: 7.2
    }

    const team2Stats = {
      Team: 'Los Angeles Lakers',
      PPG: 117.2,
      RPG: 44.2,
      APG: 27.1,
      SPG: 7.8
    }

    // Call the function
    const differences = compareTeamStats(team1Stats, team2Stats)

    // Verify result
    expect(differences.PPG).toBeCloseTo(3.3, 5)
    expect(differences.RPG).toBeCloseTo(0.1, 5)
    expect(differences.APG).toBeCloseTo(-0.3, 5)
    expect(differences.SPG).toBeCloseTo(-0.6, 5)
  })

  // Test calculateWinProbability function
  it('calculateWinProbability should calculate win probabilities based on favorable stats', () => {
    const statDifferences = {
      PPG: 3.3, // Favorable for team1
      RPG: 0.1, // Favorable for team1
      APG: -0.3, // Favorable for team2
      SPG: -0.6, // Favorable for team2
      TOV: -1.1 // TOV special case - lower is better, so favorable for team1
    }

    // Call the function
    const { team1Probability, team2Probability } =
      calculateWinProbability(statDifferences)

    // Verify result
    expect(team1Probability).toBe(0.4) // 2 out of 5 stats are favorable
    expect(team2Probability).toBe(0.6) // 3 out of 5 stats are favorable
    expect(team1Probability + team2Probability).toBe(1) // Should sum to 1
  })

  // Test fetchFromDataRetrievalApi function using more direct mocking
  it('fetchFromDataRetrievalApi should handle API responses correctly', async () => {
    // We need to restore the original https.request first
    jest.unmock('https')

    // Create a mock implementation of https.request
    const mockResponse = new EventEmitter()
    mockResponse.statusCode = 200

    const mockRequest = new EventEmitter()
    mockRequest.end = jest.fn()

    jest.spyOn(https, 'request').mockImplementation((options, callback) => {
      callback(mockResponse)
      return mockRequest
    })

    // Set up a Promise to be resolved when our function completes
    const responsePromise = fetchFromDataRetrievalApi()

    // Emit data and end events
    mockResponse.emit('data', JSON.stringify(sampleTeamsData))
    mockResponse.emit('end')

    // Wait for the promise to resolve
    const result = await responsePromise

    // Verify the result
    expect(result).toEqual(sampleTeamsData)

    // Restore original implementation
    https.request.mockRestore()
  })
})
