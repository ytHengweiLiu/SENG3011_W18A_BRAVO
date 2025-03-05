// server.js
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('SENG3011_W18A_BRAVO');
});

app.get('/sports-data', async (req, res) => {
  try {
    const sport = req.query.sport || 'football';
    const date = req.query.date || '2024-03-05';
    
    const filePath = path.join(__dirname, 'data', sport, `${date}.json`);
    
    const data = await fs.readFile(filePath, 'utf8');
    const sportsData = JSON.parse(data);
    
    res.json(sportsData);
  } catch (error) {
    res.status(404).json({ 
      error: 'Data not found',
      sport: req.query.sport,
      date: req.query.date
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
