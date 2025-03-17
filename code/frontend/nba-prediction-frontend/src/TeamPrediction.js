import React, { useState } from 'react';
import axios from 'axios';

const TeamPrediction = () => {
    const [team1Name, setTeam1Name] = useState("");
    const [team2Name, setTeam2Name] = useState("");
    const [team1Prediction, setteam1Prediction] = useState("");
    const [team2Prediction, setteam2Prediction] = useState("");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const Retrieve_API_URL = "https://szzotav54l.execute-api.us-east-1.amazonaws.com/prod/retrieve";

    const headers = { 
        "Content-Type": "application/json" 
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const response = await axios.get(Retrieve_API_URL, {
                params: {
                  team1Name: team1Name,
                  team2Name: team2Name
                },
                headers: headers
              });
            console.log("Response:", JSON.stringify(response.data, null, 4));
            const result = response.data;
            const team1Prediction = (result[team1Name] * 100).toFixed(1) + "%"; ; 
            const team2Prediction = (result[team2Name] * 100).toFixed(1) + "%"; ;
            setteam1Prediction(team1Prediction);
            setteam2Prediction(team2Prediction);
            console.log(team1Prediction);
        } catch (err) {
            if (err.response) {
                // If the error is a response error (e.g., CORS, status codes)
                console.log(err)
                setError('Error fetching prediction: ' + err.response.data.message || err.response.data || err.message);
            } else if (err.request) {
                // If the error is a request error (e.g., no response from API)
                setError('Error: No response from server');
            } else {
                // If it’s another kind of error
                setError('Error: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
            <h1>NBA Team Prediction</h1>
            <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
                <div>
                    <label htmlFor="team1Name">Team 1:</label>
                    <input
                        type="text"
                        id="team1Name"
                        value={team1Name}
                        onChange={(e) => setTeam1Name(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="team2Name">Team 2:</label>
                    <input
                        type="text"
                        id="team2Name"
                        value={team2Name}
                        onChange={(e) => setTeam2Name(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" disabled={loading}>
                    {loading ? 'Loading...' : 'Get Prediction'}
                </button>
            </form>

            {error && <div style={{ color: 'red' }}>{error}</div>}
            {team1Prediction &&
            team2Prediction && (
                <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
                    <h2>Prediction Results:</h2>
                    <p><strong>{team1Name}:</strong> {team1Prediction}</p>
                    <p><strong>{team2Name}:</strong> {team2Prediction}</p>
                </div>
            )}
        </div>
    );
};

export default TeamPrediction;
