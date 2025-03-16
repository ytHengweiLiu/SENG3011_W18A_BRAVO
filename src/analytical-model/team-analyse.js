const https = require('https')

// May need to change API endpoint
const DATA_RETRIEVAL_API =
  'https://1gz0wm5412.execute-api.us-east-1.amazonaws.com/prod/retrieve'

const fetchFromDataRetrievalApi = async () => {
  return new Promise((resolve, reject) => {
    try {
      // Parse the API URL
      const apiUrl = new URL(DATA_RETRIEVAL_API)

      console.log(`Requesting: ${apiUrl.toString()}`)

      // Request options
      const options = {
        hostname: apiUrl.hostname,
        path: apiUrl.pathname + apiUrl.search,
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      }

      console.log('Request options:', JSON.stringify(options))

      const req = https.request(options, response => {
        let data = ''

        console.log(`Response status: ${response.statusCode}`)
        console.log(`Response headers: ${JSON.stringify(response.headers)}`)

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

      // End the request
      req.end()
    } catch (error) {
      reject(new Error(`API request setup failed: ${error.message}`))
    }
  })
}

const findTeamData = (allTeams, teamName) => {
  // Find the team in the data array
  return allTeams.find(
    team =>
      team.attributes &&
      team.attributes.Team &&
      team.attributes.Team.toLowerCase() === teamName.toLowerCase()
  )
}

const extractTeamStats = teamData => {
  if (!teamData || !teamData.attributes) {
    return null
  }

  // Extract the relevant stats from attributes
  const stats = {
    'FG%': parseFloat(teamData.attributes['FG%']),
    '3P%': parseFloat(teamData.attributes['3P%']),
    AST: parseFloat(teamData.attributes['Ast']),
    REB: parseFloat(teamData.attributes['Reb']),
    STL: parseFloat(teamData.attributes['Stl']),
    PTS: parseFloat(teamData.attributes['Pts']),
    BLK: parseFloat(teamData.attributes['Blk']),
    TO: parseFloat(teamData.attributes['TO'])
  }

  return stats
}

const compareTeamStats = (team1Stats, team2Stats) => {
  console.log('Team 1 stats:', JSON.stringify(team1Stats))
  console.log('Team 2 stats:', JSON.stringify(team2Stats))

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

      console.log(`Stat: ${stat}, Value1: ${value1}, Value2: ${value2}`)

      if (!isNaN(value1) && !isNaN(value2)) {
        differences[stat] = value1 - value2
      } else {
        console.log(`Skipping stat: ${stat} due to missing or invalid values`)
      }
    }
  })
  console.log('Calculated differences:', JSON.stringify(differences))
  return differences
}

exports.handler = async (event, context) => {
  console.log('Handler started')
  try {
    console.log('Request received:', JSON.stringify(event))
    console.log('Request received:', JSON.stringify(event))

    // Parse the request parameters
    console.log('Parsing request body')
    const bodyParams = event.body ? JSON.parse(event.body) : {}
    console.log('Parsed body:', bodyParams)
    const { team1, team2 } = bodyParams
    console.log(`Extracted teams: ${team1}, ${team2}`)

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

    const allTeamsResponse = await fetchFromDataRetrievalApi()

    // Log the structure of the response
    console.log(
      'API response structure:',
      JSON.stringify({
        hasData: !!allTeamsResponse.data,
        dataIsArray: Array.isArray(allTeamsResponse.data),
        dataLength: Array.isArray(allTeamsResponse.data)
          ? allTeamsResponse.data.length
          : 0
      })
    )

    const team1Data = findTeamData(allTeamsResponse.data, team1)
    const team2Data = findTeamData(allTeamsResponse.data, team2)

    // Validate that both teams were found
    if (!team1Data || !team2Data) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Team data not found',
          message: `Could not find data for ${!team1Data ? team1 : ''} ${
            !team2Data ? team2 : ''
          }`
        })
      }
    }

    // Extract stats for both teams
    const team1Stats = extractTeamStats(team1Data)
    const team2Stats = extractTeamStats(team2Data)

    // Log the extracted stats for debugging
    console.log('Team 1 stats:', JSON.stringify(team1Stats))
    console.log('Team 2 stats:', JSON.stringify(team2Stats))

    // Check if stats were successfully extracted
    if (!team1Stats || !team2Stats) {
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
    const statDifferences = compareTeamStats(team1Stats, team2Stats)

    // Return successful response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        analysis: {
          team1: team1,
          team2: team2,
          team1Stats: team1Stats,
          team2Stats: team2Stats,
          statDifferences: statDifferences,
          analysisTimestamp: new Date().toISOString()
        }
      })
    }
  } catch (error) {
    console.error('Error processing request:', error)
    console.error('Error stack:', error.stack)

    // More detailed logging
    if (error.response) {
      console.error('Error response:', error.response)
    }

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
