const https = require('https')

// May need to change API endpoint
const DATA_RETRIEVAL_API =
  'https://wgy9k8xhz5.execute-api.us-east-1.amazonaws.com/NBAPrediction'

const fetchFromDataRetrievalApi = (params = {}) => {
  return new Promise((resolve, reject) => {
    try {
      // Parse the API URL
      const apiUrl = new URL(DATA_RETRIEVAL_API)

      // Request options
      const options = {
        hostname: apiUrl.hostname,
        path: apiUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }

      const req = https.request(options, response => {
        let data = ''

        // A chunk of data has been received
        response.on('data', chunk => {
          data += chunk
        })

        // The whole response has been received
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            return reject(
              new Error(`API request failed with status ${response.statusCode}`)
            )
          }

          try {
            const parsedData = JSON.parse(data)
            resolve(parsedData)
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}`))
          }
        })
      })

      // Handle request errors
      req.on('error', error => {
        reject(new Error(`API request failed: ${error.message}`))
      })

      // Send the data in the request body
      req.write(JSON.stringify(params))
      req.end()
    } catch (error) {
      reject(new Error(`API request setup failed: ${error.message}`))
    }
  })
}

const compareTeamStats = (team1Stats, team2Stats) => {
  const differences = {}

  // Focus on just a few key statistics for the MVP
  const keyStats = ['FG%', '3P%', 'AST', 'REB', 'STL']

  keyStats.forEach(stat => {
    if (
      typeof team1Stats[stat] === 'number' &&
      typeof team2Stats[stat] === 'number'
    ) {
      const value1 = parseFloat(team1Stats[stat])
      const value2 = parseFloat(team2Stats[stat])

      if (!isNaN(value1) && !isNaN(value2)) {
        differences[stat] = value1 - value2
      }
    }
  })

  return differences
}

exports.handler = async (event, context) => {
  try {
    console.log('Request received:', JSON.stringify(event))

    // Parse the request parameters
    const bodyParams = event.body ? JSON.parse(event.body) : {}
    const { team1, team2 } = bodyParams

    // Validate input parameters
    if (!team1 || !team2) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Missing parameters',
          message: 'Please provide team IDs (team1 and team2)'
        })
      }
    }

    // Fetch team data from the data retrieval API
    console.log(`Fetching data for teams: ${team1} and ${team2}`)

    const [team1Response, team2Response] = await Promise.all([
      fetchFromDataRetrievalApi({ teamId: team1, stats: true }),
      fetchFromDataRetrievalApi({ teamId: team2, stats: true })
    ])

    if (!team1Response.data || !team2Response.data) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Team data not found',
          message: 'Could not retrieve data for one or both teams'
        })
      }
    }

    // Validate team data structure
    if (!team1Response.data.stats || !team2Response.data.stats) {
      return {
        statusCode: 422,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Invalid data format',
          message: 'Team statistics not available in the provided data'
        })
      }
    }

    // Calculate basic statistical differences
    const statDifferences = compareTeamStats(
      team1Response.data.stats,
      team2Response.data.stats
    )

    // Return successful response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        analysis: {
          team1: team1Response.data.name || 'Team 1',
          team2: team2Response.data.name || 'Team 2',
          statDifferences: statDifferences,
          analysisTimestamp: new Date().toISOString()
        }
      })
    }
  } catch (error) {
    console.error('Error processing request:', error)

    // Return error response
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Analysis failed',
        message: 'An error occurred while processing the request'
      })
    }
  }
}
