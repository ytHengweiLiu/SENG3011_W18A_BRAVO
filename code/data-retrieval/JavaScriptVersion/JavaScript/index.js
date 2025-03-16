import "dotenv/config";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const streamToString = async (stream) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        stream.on("error", reject);
    });
};

function matchTeamData(Data, TeamName) {
    for (let i = 0; i < Data.length; i++) {
        const currentTeam = Data[i].attributes;
        if (currentTeam.Team === TeamName) {
            return currentTeam;
        }
    }
}

const client = new S3Client({
    region: "us-east-1"
});


export async function handler(event) {
    try {
        const { team1Name, team2Name } = JSON.parse(event.body);
        console.log(team1Name);
        const date = new Date().toISOString().split("T")[0];
        const input = { // GetObjectRequest
            Bucket: "nba-prediction-bucket-seng3011",
            Key: `nba-stats/${date}/data.json`,
        };
        const command = new GetObjectCommand(input);
        const response = await client.send(command);
        
        // Read the stream
        
        // Convert response body to string
        const fileContent = await streamToString(response.Body);
        
        // to JSON
        const fileJSON = JSON.parse(fileContent);
        const data = fileJSON.data;
        const team1Data = matchTeamData(data, team1Name);
        const team2Data = matchTeamData(data, team2Name);
        const formattedStats = { 
            team1: team1Data,
            team2: team2Data
        };
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                formattedStats
            })
        }; 
    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
    }
}



