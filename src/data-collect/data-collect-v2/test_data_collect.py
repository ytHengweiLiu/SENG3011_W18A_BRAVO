import unittest
from unittest.mock import patch, MagicMock
import data_collect
import json
import os

class TestLambdaHandler(unittest.TestCase):
    @patch.dict(os.environ, {"BUCKET_NAME": "fake-bucket", "AWS_REGION": "us-east-1"})
    @patch('data_collect.requests.get')
    @patch('data_collect.boto3.Session')
    def test_lambda_handler_success(self, mock_session, mock_requests_get):
        mock_s3_client = MagicMock()
        mock_session.return_value.client.return_value = mock_s3_client
        mock_s3_client.get_object.return_value = {
            'Body': MagicMock(read=lambda: b'{"events": {"some": "data"}}')
        }

        # Fake a successful NBA API response
        mock_response = MagicMock()
        mock_response.json.return_value = {"resultSets": []}
        mock_response.status_code = 200
        mock_requests_get.return_value = mock_response

        event = {
            'queryStringParameters': {
                'team1': 'LAL',
                'team2': 'BOS'
            }
        }

        response = data_collect.lambda_handler(event, None)

        print("Response:", response)

        self.assertEqual(response['statusCode'], 200)
        body = json.loads(response['body'])
        self.assertIn('message', body)
        self.assertIn('object_key', body)

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
