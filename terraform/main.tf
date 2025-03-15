# Provider Configuration
provider "aws" {
  region = "us-east-1"  # Replace with your preferred region
}

# S3 Bucket
resource "aws_s3_bucket" "nba_prediction_bucket" {
  bucket = "nba-prediction-bucket-seng3011"  # Replace with a unique name
}

# Disable ACLs and enforce bucket owner enforced
resource "aws_s3_bucket_ownership_controls" "nba_prediction_bucket_ownership" {
  bucket = aws_s3_bucket.nba_prediction_bucket.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Set the bucket policy to private
resource "aws_s3_bucket_public_access_block" "nba_prediction_bucket_public_access" {
  bucket = aws_s3_bucket.nba_prediction_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_exec_role" {
  name = "lambda_exec_role"

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

# IAM Policy for Lambda to access S3
resource "aws_iam_policy" "lambda_s3_access_policy" {
  name        = "LambdaS3AccessPolicy"
  description = "Allow Lambda to access S3 bucket"
  policy      = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Resource = "${aws_s3_bucket.nba_prediction_bucket.arn}/*"
      }
    ]
  })
}

# Attach the S3 access policy to the Lambda role
resource "aws_iam_role_policy_attachment" "lambda_s3_access" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = aws_iam_policy.lambda_s3_access_policy.arn
}

# Attach the basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda Function for Data Collection
resource "aws_lambda_function" "nba_scraper_lambda" {
  function_name = "nba-scraper-lambda"
  handler       = "data-collect.handler"  # Handler for data-collect.js
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec_role.arn

  filename         = "lambda-deployment-package-collect.zip"  # Path to the ZIP file
  source_code_hash = filebase64sha256("lambda-deployment-package-collect.zip")

  environment {
    variables = {
      S3_BUCKET_NAME = aws_s3_bucket.nba_prediction_bucket.bucket
      S3_FILE_PREFIX = "nba-stats"  # Prefix for the S3 file path
    }
  }
}

# Lambda Function for Data Retrieval
resource "aws_lambda_function" "nba_retriever_lambda" {
  function_name = "nba-retriever-lambda"
  handler       = "data-retrieve.handler"  # Handler for data-retrieve.js
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec_role.arn

  filename         = "lambda-deployment-package-retrieve.zip"  # Path to the ZIP file
  source_code_hash = filebase64sha256("lambda-deployment-package-retrieve.zip")

  environment {
    variables = {
      S3_BUCKET_NAME = aws_s3_bucket.nba_prediction_bucket.bucket
      S3_FILE_PREFIX = "nba-stats"  # Prefix for the S3 file path
    }
  }
}

# API Gateway
resource "aws_api_gateway_rest_api" "nba_prediction_api" {
  name        = "nba-prediction-api"
  description = "API Gateway for NBA Prediction Lambda"
}

# API Gateway Resource for Scrape
resource "aws_api_gateway_resource" "scrape" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  parent_id   = aws_api_gateway_rest_api.nba_prediction_api.root_resource_id
  path_part   = "scrape"  # Resource path
}

# API Gateway Method for Scrape
resource "aws_api_gateway_method" "scrape_method" {
  rest_api_id   = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id   = aws_api_gateway_resource.scrape.id
  http_method   = "GET"  # HTTP method
  authorization = "NONE"  # Allow public access
}

# API Gateway Integration for Scrape
resource "aws_api_gateway_integration" "scrape_integration" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id = aws_api_gateway_method.scrape_method.resource_id
  http_method = aws_api_gateway_method.scrape_method.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.nba_scraper_lambda.invoke_arn
}

# API Gateway Resource for Retrieve
resource "aws_api_gateway_resource" "retrieve" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  parent_id   = aws_api_gateway_rest_api.nba_prediction_api.root_resource_id
  path_part   = "retrieve"  # Resource path
}

# API Gateway Method for Retrieve
resource "aws_api_gateway_method" "retrieve_method" {
  rest_api_id   = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id   = aws_api_gateway_resource.retrieve.id
  http_method   = "GET"  # HTTP method
  authorization = "NONE"  # Allow public access
}

# API Gateway Integration for Retrieve
resource "aws_api_gateway_integration" "retrieve_integration" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id = aws_api_gateway_method.retrieve_method.resource_id
  http_method = aws_api_gateway_method.retrieve_method.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.nba_retriever_lambda.invoke_arn
}

# Lambda Permission for API Gateway (Scrape)
resource "aws_lambda_permission" "apigw_scrape_lambda" {
  statement_id  = "AllowAPIGatewayInvokeScrape"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.nba_scraper_lambda.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.nba_prediction_api.execution_arn}/*/*"
}

# Lambda Permission for API Gateway (Retrieve)
resource "aws_lambda_permission" "apigw_retriever_lambda" {
  statement_id  = "AllowAPIGatewayInvokeRetriever"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.nba_retriever_lambda.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.nba_prediction_api.execution_arn}/*/*"
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "nba_prediction_deployment" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  depends_on  = [
    aws_api_gateway_integration.scrape_integration,
    aws_api_gateway_integration.retrieve_integration
  ]
}

# API Gateway Stage
resource "aws_api_gateway_stage" "nba_prediction_stage" {
  stage_name    = "prod"
  rest_api_id   = aws_api_gateway_rest_api.nba_prediction_api.id
  deployment_id = aws_api_gateway_deployment.nba_prediction_deployment.id
}

# CloudWatch Event Rule to trigger the scraper function daily
resource "aws_cloudwatch_event_rule" "daily_scraper_trigger" {
  name                = "daily-scraper-trigger"
  description         = "Trigger the NBA scraper Lambda function daily"
  schedule_expression = "cron(0 12 * * ? *)"  # Runs daily at 12:00 PM UTC
}

# CloudWatch Event Target to invoke the scraper Lambda function
resource "aws_cloudwatch_event_target" "invoke_scraper_lambda" {
  rule      = aws_cloudwatch_event_rule.daily_scraper_trigger.name
  target_id = "InvokeScraperLambda"
  arn       = aws_lambda_function.nba_scraper_lambda.arn
}

# Lambda Permission to allow CloudWatch Events to invoke the scraper function
resource "aws_lambda_permission" "allow_cloudwatch_to_invoke_scraper" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.nba_scraper_lambda.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_scraper_trigger.arn
}

# Outputs
output "lambda_arn" {
  value = aws_lambda_function.nba_scraper_lambda.arn
}

output "api_url" {
  value = "${aws_api_gateway_deployment.nba_prediction_deployment.invoke_url}/${aws_api_gateway_stage.nba_prediction_stage.stage_name}"
}