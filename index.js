const express = require("express");
const scrapeData = require("./src/data-collect/scraper"); // Import the scraper function
require('dotenv').config();

const app = express();
const PORT = 8000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Endpoint to trigger the scraper
app.get("/scrape", async (req, res) => {
  try {
    const data = await scrapeData(); // Call the scraper function
    res.json({ message: "Scraping completed successfully!", data });
  } catch (error) {
    res.status(500).json({ message: "Scraping failed", error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});