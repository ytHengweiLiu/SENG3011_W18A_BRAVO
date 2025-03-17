locals {
  environment = terraform.workspace
  is_dev      = local.environment == "dev"

  name_suffix = local.environment == "default" ? "" : "-${local.environment}"

  # Environment-specific settings
  env_settings = {
    default = {
      name_prefix    = "prod"
      s3_file_prefix = "nba-stats"
      schedule       = "cron(0 12 * * ? *)" # Daily at 12:00 PM UTC
    }
    dev = {
      name_prefix    = "dev"
      s3_file_prefix = "nba-stats-dev"
      schedule       = "cron(0 13 * * ? *)" # Daily at 1:00 PM UTC (to avoid conflicts)
    }
  }

  # Get the current environment's settings
  current_env = local.env_settings[local.environment]
}

# Provider Configuration
provider "aws" {
  region = "us-east-1" # Replace with your preferred region
}

# S3 Bucket
resource "aws_s3_bucket" "nba_prediction_bucket" {
  bucket = "nba-prediction-bucket-seng3011" # Replace with a unique name
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
  name = "lambda_exec_role${local.name_suffix}"

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
  name        = "LambdaS3AccessPolicy${local.name_suffix}"
  description = "Allow Lambda to access S3 bucket"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = ["arn:aws:s3:::nba-prediction-bucket-seng3011${local.name_suffix}"]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = ["arn:aws:s3:::nba-prediction-bucket-seng3011${local.name_suffix}/*"]
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
  function_name = "nba-scraper-lambda-${local.current_env.name_prefix}"
  handler       = "data-collect.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec_role.arn

  filename         = "lambda-deployment-package-transform-${local.current_env.name_prefix}.zip"
  source_code_hash = filebase64sha256("lambda-deployment-package-transform-${local.current_env.name_prefix}.zip")

  environment {
    variables = {
      S3_BUCKET_NAME = aws_s3_bucket.nba_prediction_bucket.bucket
      S3_FILE_PREFIX = local.current_env.s3_file_prefix
    }
  }

  timeout = 45
}

# Lambda Function for Data Retrieval
resource "aws_lambda_function" "nba_retriever_lambda" {
  function_name = "nba-retriever-lambda-${local.current_env.name_prefix}"
  handler       = "data-retrieve.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec_role.arn

  filename         = "lambda-deployment-package-retrieve-${local.current_env.name_prefix}.zip"
  source_code_hash = filebase64sha256("lambda-deployment-package-retrieve-${local.current_env.name_prefix}.zip")

  environment {
    variables = {
      S3_BUCKET_NAME = aws_s3_bucket.nba_prediction_bucket.bucket
      S3_FILE_PREFIX = local.current_env.s3_file_prefix
    }
  }
}

# Lambda Function for Data Analysis
resource "aws_lambda_function" "nba_analyse_lambda" {
  function_name = "nba-analyse-lambda-${local.current_env.name_prefix}"
  handler       = "team-analyse.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec_role.arn

  filename         = "lambda-deployment-package-analyse-${local.current_env.name_prefix}.zip"
  source_code_hash = filebase64sha256("lambda-deployment-package-analyse-${local.current_env.name_prefix}.zip")

  timeout = 30
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
  path_part   = "scrape${local.is_dev ? "-dev" : ""}"
}

# API Gateway Method for Scrape
resource "aws_api_gateway_method" "scrape_method" {
  rest_api_id   = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id   = aws_api_gateway_resource.scrape.id
  http_method   = "GET"
  authorization = "NONE"
}

# API Gateway Integration for Scrape
resource "aws_api_gateway_integration" "scrape_integration" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id = aws_api_gateway_resource.scrape.id
  http_method = aws_api_gateway_method.scrape_method.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.nba_scraper_lambda.invoke_arn
}

# API Gateway Resource for Retrieve
resource "aws_api_gateway_resource" "retrieve" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  parent_id   = aws_api_gateway_rest_api.nba_prediction_api.root_resource_id
  path_part   = "retrieve${local.is_dev ? "-dev" : ""}"
}

# API Gateway Method for Retrieve
resource "aws_api_gateway_method" "retrieve_method" {
  rest_api_id   = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id   = aws_api_gateway_resource.retrieve.id
  http_method   = "GET"
  authorization = "NONE"
}

# API Gateway Integration for Retrieve
resource "aws_api_gateway_integration" "retrieve_integration" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id = aws_api_gateway_resource.retrieve.id
  http_method = aws_api_gateway_method.retrieve_method.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.nba_retriever_lambda.invoke_arn
}

# API Gateway Resource for Team Analysis
resource "aws_api_gateway_resource" "analyse" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  parent_id   = aws_api_gateway_rest_api.nba_prediction_api.root_resource_id
  path_part   = "analyse${local.is_dev ? "-dev" : ""}"
}

# API Gateway Method for Team Analysis
resource "aws_api_gateway_method" "analyse_method" {
  rest_api_id   = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id   = aws_api_gateway_resource.analyse.id
  http_method   = "POST"
  authorization = "NONE"
}

# API Gateway Integration for Team Analysis
resource "aws_api_gateway_integration" "analyse_integration" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id = aws_api_gateway_resource.analyse.id
  http_method = aws_api_gateway_method.analyse_method.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.nba_analyse_lambda.invoke_arn
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

# Lambda Permission for API Gateway (Team Analysis)
resource "aws_lambda_permission" "apigw_analyse_lambda" {
  statement_id  = "AllowAPIGatewayInvokeAnalyse"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.nba_analyse_lambda.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.nba_prediction_api.execution_arn}/*/*"
}

# API Gateway Method for OPTIONS (CORS)
resource "aws_api_gateway_method" "scrape_options_method" {
  rest_api_id   = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id   = aws_api_gateway_resource.scrape.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# API Gateway Integration for OPTIONS (CORS)
resource "aws_api_gateway_integration" "scrape_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id = aws_api_gateway_resource.scrape.id
  http_method = aws_api_gateway_method.scrape_options_method.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

# API Gateway Method Response for OPTIONS (CORS)
resource "aws_api_gateway_method_response" "scrape_options_response" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id = aws_api_gateway_resource.scrape.id
  http_method = aws_api_gateway_method.scrape_options_method.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

# API Gateway Integration Response for OPTIONS (CORS)
resource "aws_api_gateway_integration_response" "scrape_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id = aws_api_gateway_resource.scrape.id
  http_method = aws_api_gateway_method.scrape_options_method.http_method
  status_code = aws_api_gateway_method_response.scrape_options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "nba_prediction_deployment" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  depends_on = [
    aws_api_gateway_integration.scrape_integration,
    aws_api_gateway_integration.retrieve_integration,
    aws_api_gateway_integration.analyse_integration
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
  name                = "daily-scraper-trigger${local.name_suffix}"
  description         = "Trigger the NBA scraper Lambda function daily (${local.environment})"
  schedule_expression = local.current_env.schedule
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
