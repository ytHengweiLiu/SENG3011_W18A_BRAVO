import json
import numpy as np
from datetime import datetime
import dotenv
import boto3
import os
import pytz
import requests
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from sklearn.ensemble import RandomForestClassifier
import xgboost as xgb


def lambda_handler(event, context):
    try:
        # test CD
        # print("EVENT RECEIVED:", json.dumps(event))
        # home court advantage
        # Handles both API Gateway and direct invocation from local proxy
        team1_abbr = None
        team2_abbr = None
        home_court = None

        if event.get("queryStringParameters"):
            qs = event["queryStringParameters"]
            team1_abbr = qs.get("team1")
            team2_abbr = qs.get("team2")
            home_court = qs.get("home")

        # If not found in query, try to read from body (JSON)
        if not (team1_abbr and team2_abbr and home_court):
            body = event.get("body")
            if isinstance(body, str):
                body = json.loads(body)
            elif body is None:
                body = {}
            team1_abbr = team1_abbr or body.get("team1")
            team2_abbr = team2_abbr or body.get("team2")
            home_court = home_court or body.get("home")

        # if 'body' in event and event['body']:
        #     body = json.loads(event['body'])
            # team1_abbr = body.get('team1')
            # team2_abbr = body.get('team2')
            # home_court = body.get('home')
        # else:
        #     team1_abbr = event['queryStringParameters'].get('team1')
        #     team2_abbr = event['queryStringParameters'].get('team2')
        #     home_court = event['queryStringParameters'].get('home')

        if not team1_abbr or not team2_abbr or not home_court:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Missing team1 or team2 abbreviation or home court advantage.'})
            }

        # print(team1_abbr)
        # print(team2_abbr)
        home_court = float(home_court)
        # print(type(home_court))
        # print(home_court)

        if (not(home_court == 0 or home_court == 1)):
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'home court advantage can only be 0 or 1.'})
            }


        # AWS API Gateway Endpoints
        PREPROCESS_URL="https://h0gn7fm71g.execute-api.ap-southeast-2.amazonaws.com/dev/preprocess"
        ANALYSE_URL="https://h0gn7fm71g.execute-api.ap-southeast-2.amazonaws.com/dev/analyse"

        file_name = f"{team1_abbr}vs{team2_abbr}.json"
        # print(file_name)
        # Load variables from .env file
        dotenv.load_dotenv()

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

        # Sort events by GAME_DATE (most recent first)
        events.sort(key=lambda x: datetime.strptime(x["attributes"]["GAME_DATE"], "%Y-%m-%d"), reverse=True)

        # Take the last 10 games
        last_5_games = events[:5] if len(events) >= 5 else events
        # print(last_5_games)
        last_10_game_json_output = {
            "data_source": "nba_api",
            "dataset_type": "NBA Game Statistics",
            "dataset_id": f"{bucket_name}/{object_key}",
            "time_object": {
                "timestamp": datetime.now(pytz.timezone('UTC')).isoformat(),
                "timezone": 'UTC'
            },
            "events": last_5_games
        }


        attributes_list = []
        for event in events:
            attributes = event['attributes']
            attributes_row = list(attributes.values())
            attributes_list.append(attributes_row)
        data = np.array(attributes_list)

        X = np.delete(data, 0, axis=1)
        X = np.delete(X, 1, axis=1)
        X = np.array(X, dtype=float)
        y = data[:, 2]
        y = np.array(y, dtype=float)
        # print(X)
        # print(y)

        preprocess_response = requests.post(
            PREPROCESS_URL,
            headers={"Content-Type": "application/json"},
            data=json.dumps(last_10_game_json_output)
        )

        last_5_games_average = {
            "TEAM1_PTS": 0.0,
            "TEAM1_FGM": 0.0,
            "TEAM1_FGA": 0.0,
            "TEAM1_FG_PCT": 0.0,
            "TEAM1_FG3M": 0.0,
            "TEAM1_FG3A": 0.0,
            "TEAM1_FG3_PCT": 0.0,
            "TEAM1_FTM": 0.0,
            "TEAM1_FTA": 0.0,
            "TEAM1_FT_PCT": 0.0,
            "TEAM1_OREB": 0.0,
            "TEAM1_DREB": 0.0,
            "TEAM1_REB": 0.0,
            "TEAM1_AST": 0.0,
            "TEAM1_STL": 0.0,
            "TEAM1_BLK": 0.0,
            "TEAM1_TOV": 0.0,
            "TEAM1_PF": 0.0
        }


        if preprocess_response.status_code == 200:
            preprocessed_data = preprocess_response.json()  # Convert response to dictionary
            print("Preprocessed Data Received:",)
            

            # Send preprocessed data directly to analysis endpoint
            analyse_response = requests.post(
                ANALYSE_URL,
                headers={"Content-Type": "application/json"},
                data=json.dumps(preprocessed_data)
            )

            

            if analyse_response.status_code == 200:
                analysed_data = analyse_response.json()
                stats = analysed_data["analysis_results"]
                stats = stats["NBA Game Statistics"]
                stats = stats["summary"]
                stats = stats["statistics"]

                for stat_name, mean_value in stats.items():
                    if (stat_name != "HOME_GAME" and stat_name != "WL"):
                        last_5_games_average[stat_name] = mean_value["mean"]
                
                # last_10_game_json_output["TEAM1_PTS"] = float("nan")
                last_5_games_average = list(last_5_games_average.values())
            else:
                print(f"Error during analysis: {analyse_response.status_code}, ")
        else:
            print(f"Error during preprocessing: {preprocess_response.status_code}, ")

        print("192")
        print(f"X: {X}")
        print(f"y: {y}")
        # Split data
        print(train_test_split(X, y, test_size=0.2, random_state=42))
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        print("196")

        # # Create the XGBoost model
        # model = xgb.XGBClassifier(objective='binary:logistic', eval_metric='logloss')

        # # Train the model
        # model.fit(X_train, y_train)

        # Create the Random Forest model
        model = RandomForestClassifier(
            n_estimators=100,     # Number of trees
            max_depth=10,         # Max depth per tree
            random_state=42,
            class_weight='balanced'  # Good when your dataset is imbalanced
        )

        # Train the model
        model.fit(X_train, y_train)

        # Make predictions on the test set
        y_pred = model.predict(X_test)

        # Calculate accuracy
        accuracy = accuracy_score(y_test, y_pred)
        print(f"Accuracy: {accuracy:.4f}")

        last_5_games_average.insert(0, home_court)
        prediction_data = np.array([last_5_games_average])
        print(prediction_data)
        print(X[0])
        prediction = model.predict(prediction_data)
        prediction_proba = model.predict_proba(prediction_data)
        win_probability = prediction_proba[0][1]
        print(prediction[0])
        print(prediction_proba)

        return {
            'statusCode': 200,
            'body': json.dumps({
                'timestamp': datetime.now().timestamp() * 1000,
                'winning_rate': float(win_probability),
                'prediction': f"{team1_abbr} wins" if prediction[0] == 1 else f"{team2_abbr} wins",
                'model_accuracy': accuracy,
                'input_features': last_5_games_average
            })
        }


    except Exception as e:
        print(e)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }