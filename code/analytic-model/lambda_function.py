import json

def calculate_stat_differences(team1, team2):
    return {stat: float(team1[stat]) - float(team2[stat]) for stat in team1 if stat != "Team"}

def lambda_handler(event, context):
    body = json.loads(event["body"])
    team1 = body["team1"]
    team2 = body["team2"]
    
    diff = calculate_stat_differences(team1, team2)
    i, total = 0, 0

    for stat, value in diff.items():
        if stat == "TO":
            if value < 0:  
                i += 1
        elif value > 0:
            i += 1
        total += 1

    data = {
        team1["Team"]: i / total,
        team2["Team"]: (total - i) / total
    }

    return {
        "statusCode": 200,
        "body": json.dumps(data)
    }
