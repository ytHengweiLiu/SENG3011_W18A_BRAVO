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

# Lambda Function
resource "aws_lambda_function" "nba_scraper_lambda" {
  function_name = "nba-scraper-lambda"
  handler       = "data-collect.handler"  # Update the handler to match your file and function
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec_role.arn

  filename         = "lambda-deployment-package.zip"  # Path to the ZIP file in the root directory
  source_code_hash = filebase64sha256("lambda-deployment-package.zip")

  environment {
    variables = {
      S3_BUCKET_NAME = aws_s3_bucket.nba_prediction_bucket.bucket
    }
  }
}

# API Gateway
resource "aws_api_gateway_rest_api" "nba_prediction_api" {
  name        = "nba-prediction-api"
  description = "API Gateway for NBA Prediction Lambda"
}

# API Gateway Resource
resource "aws_api_gateway_resource" "scrape" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  parent_id   = aws_api_gateway_rest_api.nba_prediction_api.root_resource_id
  path_part   = "scrape"  # Resource path
}

# API Gateway Method
resource "aws_api_gateway_method" "scrape_method" {
  rest_api_id   = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id   = aws_api_gateway_resource.scrape.id
  http_method   = "GET"  # HTTP method
  authorization = "NONE"  # Allow public access
}

# API Gateway Integration
resource "aws_api_gateway_integration" "scrape_integration" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id = aws_api_gateway_method.scrape_method.resource_id
  http_method = aws_api_gateway_method.scrape_method.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.nba_scraper_lambda.invoke_arn
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "apigw_lambda" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.nba_scraper_lambda.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.nba_prediction_api.execution_arn}/*/*"
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "nba_prediction_deployment" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  depends_on  = [aws_api_gateway_integration.scrape_integration]
}

# API Gateway Stage
resource "aws_api_gateway_stage" "nba_prediction_stage" {
  stage_name    = "prod"
  rest_api_id   = aws_api_gateway_rest_api.nba_prediction_api.id
  deployment_id = aws_api_gateway_deployment.nba_prediction_deployment.id
}

# Outputs
output "lambda_arn" {
  value = aws_lambda_function.nba_scraper_lambda.arn
}

output "api_url" {
  value = "${aws_api_gateway_deployment.nba_prediction_deployment.invoke_url}/${aws_api_gateway_stage.nba_prediction_stage.stage_name}"
}
