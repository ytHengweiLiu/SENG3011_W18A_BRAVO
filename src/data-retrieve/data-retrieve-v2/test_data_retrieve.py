import unittest
from unittest.mock import patch, MagicMock
import data_retrieve
import json

class TestLambdaHandler(unittest.TestCase):
    @patch('data_retrieve.boto3.Session')
    def test_lambda_handler_success(self, mock_session):
        mock_s3_client = MagicMock()
        mock_session.return_value.client.return_value = mock_s3_client
        mock_s3_client.get_object.return_value = {
            'Body': MagicMock(read=lambda: b'{"events": {"some": "data"}}')
        }

        event = {
            'queryStringParameters': {
                'team1': 'LAL',
                'team2': 'BOS'
            }
        }

        response = data_retrieve.lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 200)
        body = response['body']
        self.assertIn('stats', body)

    @patch('data_retrieve.boto3.Session')
    def test_lambda_handler_missing_team_abbreviation(self, mock_session):
        event = {
            'queryStringParameters': {
                'team1': 'LAL'
            }
        }

        response = data_retrieve.lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 400)
        body = json.loads(response['body'])
        self.assertEqual(body['error'], 'Missing team1 or team2 abbreviation or home court advantagee.')

    @patch('data_retrieve.boto3.Session')
    def test_lambda_handler_invalid_team_abbreviation(self, mock_session):
        mock_s3_client = MagicMock()
        mock_session.return_value.client.return_value = mock_s3_client
        mock_s3_client.get_object.side_effect = Exception(
            "An error occurred (NoSuchKey) when calling the GetObject operation: The specified key does not exist."
        )

        event = {
            'queryStringParameters': {
                'team1': 'BOS',
                'team2': 'AAA'
            }
        }

        response = data_retrieve.lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 500)
        body = json.loads(response['body'])
        self.assertIn("An error occurred (NoSuchKey)", body['error'])

if __name__ == '__main__':
    unittest.main()
