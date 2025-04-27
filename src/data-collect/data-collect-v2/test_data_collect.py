import unittest
from unittest.mock import patch, MagicMock
import data_collect
import json
import os
import pandas as pd

class TestLambdaHandler(unittest.TestCase):
    @patch.dict(os.environ, {"BUCKET_NAME": "fake-bucket", "AWS_REGION": "us-east-1"})
    @patch('data_collect.boto3.Session')
    @patch('data_collect.leaguegamefinder.LeagueGameFinder')
    def test_lambda_handler_success(self, mock_leaguegamefinder, mock_boto3_session):
        mock_leaguegamefinder_instance = MagicMock()
        mock_leaguegamefinder.return_value = mock_leaguegamefinder_instance
        
        fake_df = pd.DataFrame([{
            'MATCHUP': 'LAL vs BOS',
            'WL': 'W',
            'PTS': 120,
            'FGM': 40,
            'FGA': 85,
            'FG_PCT': 0.470,
            'FG3M': 10,
            'FG3A': 30,
            'FG3_PCT': 0.333,
            'FTM': 30,
            'FTA': 35,
            'FT_PCT': 0.857,
            'OREB': 10,
            'DREB': 30,
            'REB': 40,
            'AST': 25,
            'STL': 7,
            'BLK': 5,
            'TOV': 12,
            'PF': 18,
            'MIN': 0,
            'SEASON_ID': '2024-25',
            'TEAM_ID': 1610612747,
            'PLUS_MINUS': 5,
            'TEAM_ABBREVIATION': 'LAL',
            'TEAM_NAME': 'Los Angeles Lakers',
            'GAME_ID': '0022100001'
        }])
        
        mock_leaguegamefinder_instance.get_data_frames.return_value = [fake_df]

        mock_s3_client = MagicMock()
        mock_boto3_session.return_value.client.return_value = mock_s3_client

        event = {
            'queryStringParameters': {
                'team1': 'LAL',
                'team2': 'BOS'
            }
        }

        response = data_collect.lambda_handler(event, None)

        print("Response:", response)

        self.assertEqual(response['statusCode'], 200)
        self.assertIn('Successfully uploaded', response['body'])

    @patch('data_collect.boto3.Session')
    def test_lambda_handler_missing_team_abbreviation(self, mock_session):
        event = {
            'queryStringParameters': {
                'team1': 'LAL'
            }
        }

        response = data_collect.lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 400)
        body = json.loads(response['body'])
        self.assertEqual(body['error'], 'Missing team1 or team2 abbreviation.')

    @patch('data_collect.boto3.Session')
    def test_lambda_handler_invalid_team_abbreviation(self, mock_session):
        event = {
            'queryStringParameters': {
                'team1': 'BOS',
                'team2': 'AAA'
            }
        }

        response = data_collect.lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 404)
        body = json.loads(response['body'])
        self.assertEqual(body['error'], 'Invalid team abbreviation provided.')

if __name__ == '__main__':
    unittest.main()
