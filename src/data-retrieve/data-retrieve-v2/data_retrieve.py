import json
from datetime import datetime
import boto3
import os

# test CD

def lambda_handler(event, context):
    try:
        # home court advantage
        if 'body' in event and event['body']:
            body = json.loads(event['body'])
            team1_abbr = body.get('team1')
            team2_abbr = body.get('team2')
        else:
            team1_abbr = event['queryStringParameters'].get('team1')
            team2_abbr = event['queryStringParameters'].get('team2')

        if not team1_abbr or not team2_abbr:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Missing team1 or team2 abbreviation or home court advantagee.'})
            }

        print(team1_abbr)
        print(team2_abbr)

        # AWS API Gateway Endpoints
        PREPROCESS_URL="https://h0gn7fm71g.execute-api.ap-southeast-2.amazonaws.com/dev/preprocess"
        ANALYSE_URL="https://h0gn7fm71g.execute-api.ap-southeast-2.amazonaws.com/dev/analyse"

        file_name = f"{team1_abbr}vs{team2_abbr}.json"
        print(file_name)

        # Get AWS credentials and S3 info from environment
        aws_access_key_id = os.getenv("aws_access_key_id")
        aws_secret_access_key = os.getenv("aws_secret_access_key")
        session = boto3.Session(
            region_name="us-east-1",
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            profile_name=None
        )
        s3 = session.client("s3")
        bucket_name = "nba-prediction-bucket-seng3011"
        object_key = f"nba_teams_match_stats/{file_name}"
        response = s3.get_object(
            Bucket=bucket_name,
            Key=object_key,
        )
        content = response['Body']
        data = json.load(content)
        events = data['events']

        return {
            'statusCode': 200,
            'body': json.dumps({
                'stats': json.dumps(events)
            })
        }


    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }