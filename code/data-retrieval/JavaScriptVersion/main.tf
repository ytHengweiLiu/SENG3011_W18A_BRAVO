provider "aws" {
  region = "us-east-1"
  profile = "SENG3011-nba"
}

# Create an IAM role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "nba_data_retrieval_lambda_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Attach IAM Policy for S3 access and CloudWatch logging
resource "aws_iam_policy" "lambda_policy" {
  name        = "nba_data_retrieval_lambda_policy"
  description = "Allows Lambda to access S3 and log to CloudWatch"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "arn:aws:s3:::nba-prediction-bucket-seng3011/nba-stats/*"
      }
    ]
  })
}

# Attach policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}

# # Package Lambda code
# data "archive_file" "lambda_zip" {
#   type        = "zip"
#   source_file = "JavaScript/index.js"
#   output_path = "index.zip"
# }

# Create Lambda function
resource "aws_lambda_function" "nba_data_retrieval_lambda" {
  function_name = "nbaDataRetrieval"
  runtime       = "nodejs18.x"
  handler       = "index.handler"
  filename      = "index.zip"
  role          = aws_iam_role.lambda_role.arn
  source_code_hash = filebase64sha256("index.zip")

  environment {
    variables = {
      BUCKET_NAME = "nba-prediction-bucket-seng3011"
    }
  }
}

resource "aws_api_gateway_rest_api" "nba_data_retrieval_api" {
  name        = "nba-data-retrieval-api"
  description = "API Gateway for NBA Data Retrieval Lambda"
}

resource "aws_api_gateway_resource" "retrieval" {
  rest_api_id = aws_api_gateway_rest_api.nba_data_retrieval_api.id
  parent_id   = aws_api_gateway_rest_api.nba_data_retrieval_api.root_resource_id
  path_part   = "nba-data-retrieval"  # Resource path
}

resource "aws_api_gateway_method" "retrieval_method" {
  rest_api_id   = aws_api_gateway_rest_api.nba_data_retrieval_api.id
  resource_id   = aws_api_gateway_resource.retrieval.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "retrieval_integration" {
  rest_api_id = aws_api_gateway_rest_api.nba_data_retrieval_api.id
  resource_id = aws_api_gateway_method.retrieval_method.resource_id
  http_method = aws_api_gateway_method.retrieval_method.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.nba_data_retrieval_lambda.invoke_arn
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "apigw_lambda" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.nba_data_retrieval_lambda.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.nba_data_retrieval_api.execution_arn}/*/*"
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "nba_data_retrieval_deployment" {
  rest_api_id = aws_api_gateway_rest_api.nba_data_retrieval_api.id
  depends_on  = [aws_api_gateway_integration.retrieval_integration]
}

# API Gateway Stage
resource "aws_api_gateway_stage" "nba_data_retrieval_stage" {
  stage_name    = "NBAPrediction"
  rest_api_id   = aws_api_gateway_rest_api.nba_data_retrieval_api.id
  deployment_id = aws_api_gateway_deployment.nba_data_retrieval_deployment.id
}

# Outputs
output "lambda_arn" {
  value = aws_lambda_function.nba_data_retrieval_lambda.arn
}

output "api_url" {
  value = "${aws_api_gateway_deployment.nba_data_retrieval_deployment.invoke_url}${aws_api_gateway_stage.nba_data_retrieval_stage.stage_name}"
}