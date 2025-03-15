const express = require("express");
const { handler } = require("./data-collect");

const app = express();
const port = 8000; // You can change this port if needed

// Middleware to parse JSON requests
app.use(express.json());

// Endpoint to invoke the Lambda function
app.post("/scrape", async (req, res) => {
  try {
    // Simulate an empty Lambda event (or use the request body if needed)
    const event = req.body || {};

    // Invoke the Lambda function
    const result = await handler(event);

    // Send the Lambda function's response back to the client
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

app.get("/scrape", async (req, res) => {
    try {
      // Simulate an empty Lambda event
      const event = {};
  
      // Invoke the Lambda function
      const result = await handler(event);
  
      // Send the Lambda function's response back to the client
      res.status(result.statusCode).json(JSON.parse(result.body));
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
  });

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});