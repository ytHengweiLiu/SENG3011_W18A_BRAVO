import "dotenv/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import axios from "axios";
import * as cheerio from "cheerio";
import express from "express";
import fs from "fs";

const app = express();

const url = "https://sports.yahoo.com/nba/stats/team/";

const scrapeNBAStats = async () => {
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
  
      const html = response.data;
      const $ = cheerio.load(html);
      
      let tableHeaders = [];
      let tableRows = [];
  
      $("table").first().find("thead tr").each((index, element) => {
        tableHeaders = $(element)
          .find("th")
          .map((i, th) => $(th).text().trim())
          .get();
      });
  
      $("table").first().find("tbody tr").each((index, element) => {
        const row = $(element)
          .find("td")
          .map((i, td) => $(td).text().trim().replace(/\s+/g, " "))
          .get();
        
        if (row.length > 0) {
          let rowObject = { attributes: {} };
          tableHeaders.forEach((header, i) => {
            rowObject.attributes[header] = row[i] || "";
          });
          tableRows.push(rowObject);
        }
      });
  
      const jsonData = { data: tableRows };
  
      fs.writeFileSync("nbaTeamData.json", JSON.stringify(jsonData, null, 2));
      console.log("Success");
    } catch (error) {
      console.error("Error:", error.response ? error.response.status : error.message);
    }
  };
  
scrapeNBAStats();  


(async () => {
    const client = new S3Client({
        region: "us-east-1"
    });
    
    const fileStream = fs.createReadStream("nbaTeamData.json");

    const input = {
        Bucket: "nba-teams-data",
        Key: "nbaTeamData.json",
        Body: fileStream
    };
    
    const command = new PutObjectCommand(input);
    const response = await client.send(command);
    console.log("response:", response);
})()
