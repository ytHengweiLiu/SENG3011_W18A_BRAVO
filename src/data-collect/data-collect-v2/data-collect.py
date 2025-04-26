from nba_api.stats.endpoints import leaguegamefinder
from nba_api.stats.static import teams
import pandas as pd
from datetime import datetime
import pytz
import json
import boto3
import os

# Abbreviation: ATL, Team Full Name: Atlanta Hawks
# Abbreviation: BOS, Team Full Name: Boston Celtics       
# Abbreviation: CLE, Team Full Name: Cleveland Cavaliers  
# Abbreviation: NOP, Team Full Name: New Orleans Pelicans 
# Abbreviation: CHI, Team Full Name: Chicago Bulls        
# Abbreviation: DAL, Team Full Name: Dallas Mavericks     
# Abbreviation: DEN, Team Full Name: Denver Nuggets       
# Abbreviation: GSW, Team Full Name: Golden State Warriors
# Abbreviation: HOU, Team Full Name: Houston Rockets      
# Abbreviation: LAC, Team Full Name: Los Angeles Clippers 
# Abbreviation: LAL, Team Full Name: Los Angeles Lakers   
# Abbreviation: MIA, Team Full Name: Miami Heat
# Abbreviation: MIL, Team Full Name: Milwaukee Bucks
# Abbreviation: MIN, Team Full Name: Minnesota Timberwolves
# Abbreviation: BKN, Team Full Name: Brooklyn Nets
# Abbreviation: NYK, Team Full Name: New York Knicks
# Abbreviation: ORL, Team Full Name: Orlando Magic
# Abbreviation: IND, Team Full Name: Indiana Pacers
# Abbreviation: PHI, Team Full Name: Philadelphia 76ers
# Abbreviation: PHX, Team Full Name: Phoenix Suns
# Abbreviation: POR, Team Full Name: Portland Trail Blazers
# Abbreviation: SAC, Team Full Name: Sacramento Kings
# Abbreviation: SAS, Team Full Name: San Antonio Spurs
# Abbreviation: OKC, Team Full Name: Oklahoma City Thunder
# Abbreviation: TOR, Team Full Name: Toronto Raptors
# Abbreviation: UTA, Team Full Name: Utah Jazz
# Abbreviation: MEM, Team Full Name: Memphis Grizzlies
# Abbreviation: WAS, Team Full Name: Washington Wizards
# Abbreviation: DET, Team Full Name: Detroit Pistons
# Abbreviation: CHA, Team Full Name: Charlotte Hornets

custom_headers = {
    'Host': 'stats.nba.com',
    'Connection': 'keep-alive',
    'Cache-Control': 'max-age=0',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.86 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
}

proxy_dict = {
    "http": os.getenv("SMARTPROXY_HTTP"),
    "https": os.getenv("SMARTPROXY_HTTPS")
}

proxy = proxy_dict["https"]

def match_teams_stats(team, vs_team, team_number):
    # Get recent games between Lakers and Warriors
    team_playoff_game_finder = leaguegamefinder.LeagueGameFinder(team_id_nullable=team['id'], vs_team_id_nullable=vs_team['id'], season_type_nullable="Playoffs", proxy=proxy)
    team_regular_game_finder = leaguegamefinder.LeagueGameFinder(team_id_nullable=team['id'], vs_team_id_nullable=vs_team['id'], season_type_nullable="Regular Season", proxy=proxy)
    team_playoff_games = team_playoff_game_finder.get_data_frames()[0].head(10)
    team_regular_games = team_regular_game_finder.get_data_frames()[0].head(100)

    # Modify the 'MATCHUP' and 'WL' columns
    team_playoff_games['MATCHUP'] = team_playoff_games['MATCHUP'].apply(lambda x: 1 if 'vs.' in x else 0)
    team_regular_games['MATCHUP'] = team_regular_games['MATCHUP'].apply(lambda x: 1 if 'vs.' in x else 0)

    team_playoff_games['WL'] = team_playoff_games['WL'].apply(lambda x: 1 if x == 'W' else 0)
    team_regular_games['WL'] = team_regular_games['WL'].apply(lambda x: 1 if x == 'W' else 0)

    team_playoff_games = team_playoff_games.drop(columns=['MIN', 'SEASON_ID', 'TEAM_ID', 'PLUS_MINUS', 'TEAM_ABBREVIATION', 'TEAM_NAME', "GAME_ID"])
    team_regular_games = team_regular_games.drop(columns=['MIN', 'SEASON_ID', 'TEAM_ID', 'PLUS_MINUS', 'TEAM_ABBREVIATION', 'TEAM_NAME', "GAME_ID"])

    team_playoff_games = team_playoff_games.rename(columns={
        'MATCHUP': 'HOME_GAME',
        'PTS': f'TEAM{team_number}_PTS', 
        "FGM": f'TEAM{team_number}_FGM',
        "FGA": f'TEAM{team_number}_FGA',
        "FG_PCT": f'TEAM{team_number}_FG_PCT',
        "FG3M": f'TEAM{team_number}_FG3M',
        "FG3A": f'TEAM{team_number}_FG3A',
        "FG3_PCT": f'TEAM{team_number}_FG3_PCT',
        "FTM": f'TEAM{team_number}_FTM',
        "FTA": f'TEAM{team_number}_FTA',
        "FT_PCT":f'TEAM{team_number}_FT_PCT',
        "OREB": f'TEAM{team_number}_OREB',
        "DREB": f'TEAM{team_number}_DREB',
        "REB": f'TEAM{team_number}_REB',
        "AST": f'TEAM{team_number}_AST',
        "STL": f'TEAM{team_number}_STL',
        "BLK": f'TEAM{team_number}_BLK',
        "TOV": f'TEAM{team_number}_TOV',
        "PF": f'TEAM{team_number}_PF'
    })
    team_regular_games = team_regular_games.rename(columns={
        'MATCHUP': 'HOME_GAME',
        'PTS': f'TEAM{team_number}_PTS', 
        "FGM": f'TEAM{team_number}_FGM',
        "FGA": f'TEAM{team_number}_FGA',
        "FG_PCT": f'TEAM{team_number}_FG_PCT',
        "FG3M": f'TEAM{team_number}_FG3M',
        "FG3A": f'TEAM{team_number}_FG3A',
        "FG3_PCT": f'TEAM{team_number}_FG3_PCT',
        "FTM": f'TEAM{team_number}_FTM',
        "FTA": f'TEAM{team_number}_FTA',
        "FT_PCT":f'TEAM{team_number}_FT_PCT',
        "OREB": f'TEAM{team_number}_OREB',
        "DREB": f'TEAM{team_number}_DREB',
        "REB": f'TEAM{team_number}_REB',
        "AST": f'TEAM{team_number}_AST',
        "STL": f'TEAM{team_number}_STL',
        "BLK": f'TEAM{team_number}_BLK',
        "TOV": f'TEAM{team_number}_TOV',
        "PF": f'TEAM{team_number}_PF'
    })
    games = pd.concat([team_playoff_games, team_regular_games], ignore_index=True)
    return games


def lambda_handler(event, context):
    try:
        # # Parse input (support both query string and JSON body)
        # if 'body' in event and event['body']:
        #     body = json.loads(event['body'])
        #     team1_abbr = body.get('team1')
        #     team2_abbr = body.get('team2')
        # else:
        #     team1_abbr = event['queryStringParameters'].get('team1')
        #     team2_abbr = event['queryStringParameters'].get('team2')
        
        team1_abbr = None
        team2_abbr = None

        if event.get("queryStringParameters"):
            qs = event["queryStringParameters"]
            team1_abbr = qs.get("team1")
            team2_abbr = qs.get("team2")

        # If not found in query, try to read from body (JSON)
        if not (team1_abbr and team2_abbr):
            body = event.get("body")
            if isinstance(body, str):
                body = json.loads(body)
            elif body is None:
                body = {}
            team1_abbr = team1_abbr or body.get("team1")
            team2_abbr = team2_abbr or body.get("team2")

        if not team1_abbr or not team2_abbr:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Missing team1 or team2 abbreviation.'})
            }

        team1 = [team for team in teams.get_teams() if team['abbreviation'] == team1_abbr]
        team2 = [team for team in teams.get_teams() if team['abbreviation'] == team2_abbr]
        
        if not team1 or not team2:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Invalid team abbreviation provided.'})
            }

        events = []
        timestamp = datetime.now(pytz.timezone('UTC')).isoformat()
        timezone = 'UTC'

        team1 = team1[0]
        team2 = team2[0]
        team1_games = match_teams_stats(team1, team2, 1)
        combined_teams = team1_games

        for index, row in combined_teams.iterrows():
            event = {
                "time_object": {
                    "timestamp": timestamp,
                    "duration": 1,
                    "duration_unit": "day",
                    "timezone": timezone,
                },
                "event_type": 'game_statistics',
                "attributes": row.to_dict()
            }
            events.append(event)

        # Get AWS credentials and S3 info from environment
        session = boto3.Session(
            region_name="us-east-1",
            aws_access_key_id=os.getenv("access_key_id"),
            aws_secret_access_key=os.getenv("secret_access_key"),
            profile_name=None
        )
        s3 = session.client("s3")
        bucket_name = "nba-prediction-bucket-seng3011"
        file_name = f"{team1['abbreviation']}vs{team2['abbreviation']}.json"
        object_key = f"nba_teams_match_stats/{file_name}"

        json_output = {
            "data_source": "nba_api",
            "dataset_type": "NBA Game Statistics",
            "dataset_id": f"{bucket_name}/{object_key}",
            "time_object": {
                "timestamp": timestamp,
                "timezone": timezone
            },
            "events": events
        }


        s3.put_object(
            Bucket=bucket_name,
            Key=object_key,
            Body=json.dumps(json_output),
            ContentType='application/json'
        )
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Successfully uploaded!', 'object_key': f"{team1_abbr.upper()}vs{team2_abbr.upper()}.json"})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }