import "dotenv/config";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"; // ES Modules import

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
        if (currentTeam.Team = TeamName) {
            return currentTeam;
        }
    }
}

const client = new S3Client({
    region: "us-east-1"
});

exports.handler = async (event) => {
    try {
        const input = { // GetObjectRequest
            Bucket: "nba-teams-data",
            Key: "nbaTeamData.json",
        };
        const command = new GetObjectCommand(input);
        const response = await client.send(command);
        
        // Read the stream
        
        // Convert response body to string
        const fileContent = await streamToString(response.Body);
        
        // to JSON
        const fileJSON = JSON.parse(fileContent);
        const data = fileJSON.data;
        console.log(matchTeamData(data, "Boston"));
        console.log(event);
    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
    }
}



