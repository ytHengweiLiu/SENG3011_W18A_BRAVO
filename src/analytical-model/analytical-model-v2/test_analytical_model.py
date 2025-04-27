import unittest
from unittest.mock import patch, MagicMock
import analytical_model
import json

class TestLambdaHandler(unittest.TestCase):
    # @patch('analytical_model.boto3.client')
    # def test_lambda_handler_success(self, mock_client):
    #     # Create a mock S3 client
    #     mock_s3 = MagicMock()
    #     mock_client.return_value = mock_s3
        
    #     # Mock the response from S3 for both team files
    #     mock_s3.get_object.side_effect = [
    #         {'Body': MagicMock(read=lambda: json.dumps({'team_stats': 'test_data_team1'}).encode())},
    #         {'Body': MagicMock(read=lambda: json.dumps({'team_stats': 'test_data_team2'}).encode())}
    #     ]
        
    #     event = {
    #         'queryStringParameters': {
    #             'team1': 'BOS',
    #             'team2': 'LAL',
    #             'home': '1'
    #         }
    #     }

    #     response = analytical_model.lambda_handler(event, None)
    #     self.assertEqual(response['statusCode'], 200)
    @patch('analytical_model.boto3.Session')
    def test_lambda_handler_missing_team_abbreviation(self, mock_session):
        event = {
            'queryStringParameters': {
                'team1': 'LAL'
            }
        }

        response = analytical_model.lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 400)
        body = json.loads(response['body'])
        self.assertEqual(body['error'], 'Missing team1 or team2 abbreviation or home court advantage.')

    @patch('analytical_model.boto3.Session')
    def test_lambda_handler_invalid_team_abbreviation(self, mock_session):
        mock_s3_client = MagicMock()
        mock_session.return_value.client.return_value = mock_s3_client
        mock_s3_client.get_object.side_effect = Exception(
            "An error occurred (NoSuchKey) when calling the GetObject operation: The specified key does not exist."
        )

        event = {
            'queryStringParameters': {
                'team1': 'BOS',
                'team2': 'AAA',
                'home': '0'
            }
        }

        response = analytical_model.lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 500)
        body = json.loads(response['body'])
        self.assertIn("An error occurred (NoSuchKey)", body['error'])

    @patch('analytical_model.boto3.Session')
    def test_lambda_handler_invalid_home(self, mock_session):
        event = {
            'queryStringParameters': {
                'team1': 'BOS',
                'team2': 'LAL',
                'home': '9'
            }
        }

        response = analytical_model.lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 400)
        body = json.loads(response['body'])
        self.assertEqual(body['error'], 'home court advantage can only be 0 or 1.')

if __name__ == '__main__':
    unittest.main()
