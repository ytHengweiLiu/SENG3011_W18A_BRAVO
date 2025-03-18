const https = require('https')

// May need to change API endpoint
const DATA_RETRIEVAL_API =
  process.env.DATA_RETRIEVAL_API ||
  'https://j25ls96ohb.execute-api.us-east-1.amazonaws.com/prod/retrieve-dev' // Fallback for local testing

const fetchFromDataRetrievalApi = async () => {
  return new Promise((resolve, reject) => {
    try {
      // Parse the API URL
      const apiUrl = new URL(DATA_RETRIEVAL_API)

      // Request options
      const options = {
        hostname: apiUrl.hostname,
        path: apiUrl.pathname + apiUrl.search,
        method: 'GET',
        headers: {
          Accept: 'application/json'
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

      // End the request
      req.end()
    } catch (error) {
      reject(new Error(`API request setup failed: ${error.message}`))
    }
  })
}

const findTeamData = (allTeams, teamName) => {
  if (!allTeams || !allTeams.events || !Array.isArray(allTeams.events)) {
    console.error('Invalid ADAGE data structure:', JSON.stringify(allTeams));
    return null;
  }

  // Find the team in the events array
  return allTeams.events.find(
    event =>
      event.attributes &&
      event.attributes.Team &&
      event.attributes.Team.toLowerCase() === teamName.toLowerCase()
  );

  // // Find the team in the data array
  // return allTeams.find(
  //   team =>
  //     team.attributes &&
  //     team.attributes.Team &&
  //     team.attributes.Team.toLowerCase() === teamName.toLowerCase()
  // )
}

const extractTeamStats = teamData => {
  if (!teamData || !teamData.attributes) {
    return null
  }

  const stats = { ...teamData.attributes }

  // Convert string values to numbers
  Object.keys(stats).forEach(key => {
    if (key !== 'Team' && typeof stats[key] === 'string') {
      stats[key] = parseFloat(stats[key])
    }
  })

  return stats
}

const compareTeamStats = (team1Stats, team2Stats) => {
  console.log('Team 1 stats:', JSON.stringify(team1Stats))
  console.log('Team 2 stats:', JSON.stringify(team2Stats))

  const differences = {}

  // Calculate differences for all stats except Team
  Object.keys(team1Stats).forEach(stat => {
    if (
      stat !== 'Team' &&
      typeof team1Stats[stat] === 'number' &&
      typeof team2Stats[stat] === 'number'
    ) {
      differences[stat] = team1Stats[stat] - team2Stats[stat]
    }
  })

  console.log('Calculated differences:', JSON.stringify(differences))
  return differences
}

const calculateWinProbability = statDifferences => {
  let favorableStats = 0
  let totalStats = 0

  // Count favorable stats for team1
  Object.entries(statDifferences).forEach(([stat, value]) => {
    totalStats++

    // For turnovers, lower is better (negative difference is favorable)
    if (stat === 'TO') {
      if (value < 0) {
        favorableStats++
      }
    }
    // For all other stats, higher is better (positive difference is favorable)
    else if (value > 0) {
      favorableStats++
    }
  })

  // Calculate probability for each team
  const team1Probability = favorableStats / totalStats
  const team2Probability = (totalStats - favorableStats) / totalStats

  return { team1Probability, team2Probability }
}

exports.handler = async (event, context) => {
  try {
    console.log("Request received:", JSON.stringify(event));
    const bodyParams = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const { team1, team2 } = bodyParams;

    if (!team1 || !team2) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
          "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        },
        body: JSON.stringify({
          error: "Missing parameters",
          message: "Please provide team IDs (team1 and team2)",
        }),
      };
    }

    console.log(`Fetching data for teams: ${team1} and ${team2}`);
    const allTeamsResponse = await fetchFromDataRetrievalApi();

    console.log(
      "API response structure:",
      JSON.stringify({
        hasEvents: !!allTeamsResponse.events,
        eventsIsArray: Array.isArray(allTeamsResponse.events),
        eventsLength: Array.isArray(allTeamsResponse.events) ? allTeamsResponse.events.length : 0,
      })
    );

    const team1Data = findTeamData(allTeamsResponse, team1);
    const team2Data = findTeamData(allTeamsResponse, team2);

    if (!team1Data || !team2Data) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
          "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        },
        body: JSON.stringify({
          error: "Team data not found",
          message: `Could not find data for ${!team1Data ? team1 : ""} ${!team2Data ? team2 : ""}`,
        }),
      };
    }

    const team1Stats = extractTeamStats(team1Data);
    const team2Stats = extractTeamStats(team2Data);

    if (!team1Stats || !team2Stats) {
      return {
        statusCode: 422,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
          "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        },
        body: JSON.stringify({
          error: "Invalid data format",
          message: "Team statistics not available in the provided data",
        }),
      };
    }

    const statDifferences = compareTeamStats(team1Stats, team2Stats);
    const { team1Probability, team2Probability } = calculateWinProbability(statDifferences);

    console.log(
      "Win probabilities:",
      JSON.stringify({
        [team1Stats.Team]: team1Probability,
        [team2Stats.Team]: team2Probability,
      })
    );

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      },
      body: JSON.stringify({
        analysis: {
          winProbabilities: {
            [team1Stats.Team]: team1Probability,
            [team2Stats.Team]: team2Probability,
          },
          analysisTimestamp: new Date().toISOString(),
        },
      }),
    };
  } catch (error) {
    console.error("Error processing request:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      },
      body: JSON.stringify({
        error: "Analysis failed",
        message: "An error occurred while processing the request",
      }),
    };
  }
};
