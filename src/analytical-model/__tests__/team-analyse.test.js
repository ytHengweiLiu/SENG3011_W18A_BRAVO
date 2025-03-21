const { describe, expect, test, beforeEach, jest } = require('@jest/globals');
const https = require('https');
const teamAnalyse = require('../team-analyse');

// Mock the https module
jest.mock('https', () => {
  const mockRequest = {
    on: jest.fn(),
    end: jest.fn()
  };
  return {
    request: jest.fn(() => mockRequest)
  };
});

describe('NBA Team Analysis Lambda', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Mock data for tests
  const mockTeamsData = {
    events: [
      {
        attributes: {
          Team: 'Lakers',
          PTS: '120.5',
          AST: '25.3',
          REB: '43.2',
          TO: '12.4'
        }
      },
      {
        attributes: {
          Team: 'Celtics',
          PTS: '115.8',
          AST: '23.1',
          REB: '45.6',
          TO: '11.2'
        }
      }
    ]
  };

  describe('fetchFromDataRetrievalApi', () => {
    test('successfully fetches data from API', async () => {
      // Set up the mock response
      const response = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(mockTeamsData));
          }
          if (event === 'end') {
            callback();
          }
          return response;
        })
      };

      // Set up the mock request
      https.request.mockImplementation((options, callback) => {
        callback(response);
        return {
          on: jest.fn(),
          end: jest.fn()
        };
      });

      // Call the function
      const result = await teamAnalyse.__get__('fetchFromDataRetrievalApi')();

      // Assert the result
      expect(result).toEqual(mockTeamsData);
      expect(https.request).toHaveBeenCalled();
    });

    test('handles API request failure', async () => {
      // Set up the mock response with error status
      const response = {
        statusCode: 500,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback('Error message');
          }
          if (event === 'end') {
            callback();
          }
          return response;
        })
      };

      // Set up the mock request
      https.request.mockImplementation((options, callback) => {
        callback(response);
        return {
          on: jest.fn(),
          end: jest.fn()
        };
      });

      // Call the function and expect it to reject
      await expect(teamAnalyse.__get__('fetchFromDataRetrievalApi')()).rejects.toThrow(
        'API request failed with status 500'
      );
    });

    test('handles JSON parsing errors', async () => {
      // Set up the mock response with invalid JSON
      const response = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback('invalid json data');
          }
          if (event === 'end') {
            callback();
          }
          return response;
        })
      };

      // Set up the mock request
      https.request.mockImplementation((options, callback) => {
        callback(response);
        return {
          on: jest.fn(),
          end: jest.fn()
        };
      });

      // Call the function and expect it to reject
      await expect(teamAnalyse.__get__('fetchFromDataRetrievalApi')()).rejects.toThrow(
        'Failed to parse API response'
      );
    });

    test('handles request errors', async () => {
      // Set up the mock to simulate request error
      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Network error'));
          }
          return mockRequest;
        }),
        end: jest.fn()
      };

      https.request.mockReturnValue(mockRequest);

      // Call the function and expect it to reject
      await expect(teamAnalyse.__get__('fetchFromDataRetrievalApi')()).rejects.toThrow(
        'API request failed: Network error'
      );
    });
  });

  describe('findTeamData', () => {
    test('finds team data when available', () => {
      const findTeamData = teamAnalyse.__get__('findTeamData');
      const result = findTeamData(mockTeamsData, 'Lakers');
      
      expect(result).toEqual(mockTeamsData.events[0]);
    });

    test('returns null when team is not found', () => {
      const findTeamData = teamAnalyse.__get__('findTeamData');
      const result = findTeamData(mockTeamsData, 'Warriors');
      
      expect(result).toBeNull();
    });

    test('handles case-insensitive team names', () => {
      const findTeamData = teamAnalyse.__get__('findTeamData');
      const result = findTeamData(mockTeamsData, 'celtics');
      
      expect(result).toEqual(mockTeamsData.events[1]);
    });

    test('handles invalid data structure', () => {
      const findTeamData = teamAnalyse.__get__('findTeamData');
      
      // Test with null
      expect(findTeamData(null, 'Lakers')).toBeNull();
      
      // Test with invalid structure
      expect(findTeamData({}, 'Lakers')).toBeNull();
      expect(findTeamData({ events: 'not an array' }, 'Lakers')).toBeNull();
    });
  });

  describe('extractTeamStats', () => {
    test('extracts and converts stats correctly', () => {
      const extractTeamStats = teamAnalyse.__get__('extractTeamStats');
      const teamData = mockTeamsData.events[0];
      const result = extractTeamStats(teamData);
      
      expect(result).toEqual({
        Team: 'Lakers',
        PTS: 120.5,
        AST: 25.3,
        REB: 43.2,
        TO: 12.4
      });
    });

    test('handles null or missing data', () => {
      const extractTeamStats = teamAnalyse.__get__('extractTeamStats');
      
      expect(extractTeamStats(null)).toBeNull();
      expect(extractTeamStats({})).toBeNull();
    });
  });

  describe('compareTeamStats', () => {
    test('calculates stat differences correctly', () => {
      const compareTeamStats = teamAnalyse.__get__('compareTeamStats');
      const team1Stats = {
        Team: 'Lakers',
        PTS: 120.5,
        AST: 25.3,
        REB: 43.2,
        TO: 12.4
      };
      
      const team2Stats = {
        Team: 'Celtics',
        PTS: 115.8,
        AST: 23.1,
        REB: 45.6,
        TO: 11.2
      };
      
      const result = compareTeamStats(team1Stats, team2Stats);
      
      expect(result).toEqual({
        PTS: 4.7,
        AST: 2.2,
        REB: -2.4,
        TO: 1.2
      });
    });

    test('ignores non-numeric stats', () => {
      const compareTeamStats = teamAnalyse.__get__('compareTeamStats');
      const team1Stats = {
        Team: 'Lakers',
        PTS: 120.5,
        Coach: 'Darvin Ham'
      };
      
      const team2Stats = {
        Team: 'Celtics',
        PTS: 115.8,
        Coach: 'Joe Mazzulla'
      };
      
      const result = compareTeamStats(team1Stats, team2Stats);
      
      expect(result).toEqual({
        PTS: 4.7
      });
    });
  });

  describe('calculateWinProbability', () => {
    test('calculates win probabilities correctly', () => {
      const calculateWinProbability = teamAnalyse.__get__('calculateWinProbability');
      const statDifferences = {
        PTS: 4.7,   // favorable for team1
        AST: 2.2,   // favorable for team1
        REB: -2.4,  // unfavorable for team1
        TO: 1.2     // unfavorable for team1 (lower TO is better)
      };
      
      const result = calculateWinProbability(statDifferences);
      
      expect(result).toEqual({
        team1Probability: 0.5,  // 2 out of 4 stats are favorable
        team2Probability: 0.5   // 2 out of 4 stats are favorable
      });
    });

    test('correctly treats TO (turnovers) stats differently', () => {
      const calculateWinProbability = teamAnalyse.__get__('calculateWinProbability');
      const statDifferences = {
        PTS: 4.7,   // favorable for team1
        TO: -1.2    // favorable for team1 (negative TO difference is good)
      };
      
      const result = calculateWinProbability(statDifferences);
      
      expect(result).toEqual({
        team1Probability: 1.0,  // 2 out of 2 stats are favorable
        team2Probability: 0.0   // 0 out of 2 stats are favorable
      });
    });
  });

  describe('Lambda handler', () => {
    beforeEach(() => {
      // Mock internal functions to allow isolated testing of the handler
      jest.spyOn(teamAnalyse.__get__('fetchFromDataRetrievalApi'), 'fetchFromDataRetrievalApi').mockImplementation(() => Promise.resolve(mockTeamsData));
    });

    test('processes valid input from queryStringParameters correctly', async () => {
      const event = {
        queryStringParameters: {
          team1: 'Lakers',
          team2: 'Celtics'
        }
      };
      
      const response = await teamAnalyse.handler(event);
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('analysis.winProbabilities');
    });

    test('processes valid input from JSON body correctly', async () => {
      const event = {
        body: JSON.stringify({
          team1: 'Lakers',
          team2: 'Celtics'
        })
      };
      
      const response = await teamAnalyse.handler(event);
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('analysis.winProbabilities');
    });

    test('processes direct event properties correctly', async () => {
      const event = {
        team1: 'Lakers',
        team2: 'Celtics'
      };
      
      const response = await teamAnalyse.handler(event);
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('analysis.winProbabilities');
    });

    test('returns 400 error when missing parameters', async () => {
      const event = {
        queryStringParameters: {
          team1: 'Lakers'
          // team2 is missing
        }
      };
      
      const response = await teamAnalyse.handler(event);
      
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Missing parameters');
    });

    test('returns 404 error when team not found', async () => {
      // Mock findTeamData to simulate team not found
      jest.spyOn(teamAnalyse.__get__('findTeamData'), 'findTeamData').mockImplementation(() => null);
      
      const event = {
        queryStringParameters: {
          team1: 'Lakers',
          team2: 'NonExistentTeam'
        }
      };
      
      const response = await teamAnalyse.handler(event);
      
      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Team data not found');
    });

    test('returns 422 error when team stats extraction fails', async () => {
      // Mock to return invalid team data format
      jest.spyOn(teamAnalyse.__get__('extractTeamStats'), 'extractTeamStats').mockImplementation(() => null);
      
      const event = {
        queryStringParameters: {
          team1: 'Lakers',
          team2: 'Celtics'
        }
      };
      
      const response = await teamAnalyse.handler(event);
      
      expect(response.statusCode).toBe(422);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Invalid data format');
    });

    test('returns 500 error when unexpected error occurs', async () => {
      // Mock to throw an unexpected error
      jest.spyOn(teamAnalyse.__get__('fetchFromDataRetrievalApi'), 'fetchFromDataRetrievalApi').mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      const event = {
        queryStringParameters: {
          team1: 'Lakers',
          team2: 'Celtics'
        }
      };
      
      const response = await teamAnalyse.handler(event);
      
      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Analysis failed');
    });
  });
});
