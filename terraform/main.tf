locals {
  environment = terraform.workspace
  is_dev      = local.environment == "dev"

  name_suffix = local.environment == "default" ? "" : "-${local.environment}"

  # Environment-specific settings
  env_settings = {
    default = {
      name_prefix    = "prod"
      s3_file_prefix = "nba-stats"
      schedule       = "cron(0 0 * * ? *)" # Daily at 12:00 AM UTC (midnight)
    }
    dev = {
      name_prefix    = "dev"
      s3_file_prefix = "nba-stats-dev"
      schedule       = "cron(0 1 * * ? *)" # Daily at 1:00 AM UTC (to avoid conflicts)
    }
  }
  env_config = local.env_settings[local.environment]
}

# Provider Configuration
provider "aws" {
  region = "us-east-1"
}

# Check if the S3 Bucket exists
data "aws_s3_bucket" "nba_prediction_bucket" {
  bucket = "nba-prediction-bucket-seng3011"
}

# Disable ACLs and enforce bucket owner enforced
resource "aws_s3_bucket_ownership_controls" "nba_prediction_bucket_ownership" {
  bucket = data.aws_s3_bucket.nba_prediction_bucket.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Set the bucket policy to private
resource "aws_s3_bucket_public_access_block" "nba_prediction_bucket_public_access" {
  bucket = data.aws_s3_bucket.nba_prediction_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM Role: Check if the IAM role exists
data "aws_iam_role" "lambda_exec_role" {
  name = "lambda_exec_role"
}

# IAM Policy: Check if the IAM policy exists
data "aws_iam_policy" "lambda_s3_access_policy" {
  name = "LambdaS3AccessPolicy"
}

# Attach the S3 access policy to the Lambda role
resource "aws_iam_role_policy_attachment" "lambda_s3_access" {
  role       = data.aws_iam_role.lambda_exec_role.name
  policy_arn = data.aws_iam_policy.lambda_s3_access_policy.arn
}

# Attach the basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = data.aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda Function for Data Collection
resource "aws_lambda_function" "nba_scraper_lambda" {
  function_name = "nba-scraper-lambda${local.name_suffix}"
  handler       = "data-collect.handler"
  runtime       = "nodejs18.x"
  role          = data.aws_iam_role.lambda_exec_role.arn

  filename         = "lambda-deployment-package-collect${local.name_suffix}.zip"
  source_code_hash = filebase64sha256("lambda-deployment-package-collect${local.name_suffix}.zip")

  environment {
    variables = {
      S3_BUCKET_NAME = data.aws_s3_bucket.nba_prediction_bucket.bucket
      S3_FILE_PREFIX = local.env_config.s3_file_prefix
    }
  }

  timeout = 29
}

# Lambda Function for Data Retrieval
resource "aws_lambda_function" "nba_retriever_lambda" {
  function_name = "nba-retriever-lambda${local.name_suffix}"
  handler       = "data-retrieve.handler"
  runtime       = "nodejs18.x"
  role          = data.aws_iam_role.lambda_exec_role.arn

  filename         = "lambda-deployment-package-retrieve${local.name_suffix}.zip"
  source_code_hash = filebase64sha256("lambda-deployment-package-retrieve${local.name_suffix}.zip")

  environment {
    variables = {
      S3_BUCKET_NAME = data.aws_s3_bucket.nba_prediction_bucket.bucket
      S3_FILE_PREFIX = local.env_config.s3_file_prefix
    }
  }
}

# Lambda Function for Data Analysis
resource "aws_lambda_function" "nba_analyse_lambda" {
  function_name = "nba-analyse-lambda${local.name_suffix}"
  handler       = "team-analyse.handler"
  runtime       = "nodejs18.x"
  role          = data.aws_iam_role.lambda_exec_role.arn

  filename         = "lambda-deployment-package-analyse${local.name_suffix}.zip"
  source_code_hash = filebase64sha256("lambda-deployment-package-analyse${local.name_suffix}.zip")

  timeout = 29

  environment {
    variables = {
      # TODO: fix URLs
      DATA_RETRIEVAL_API = local.environment == "dev" ? "https://j25ls96ohb.execute-api.us-east-1.amazonaws.com/prod/retrieve-dev" : "https://szzotav54l.execute-api.us-east-1.amazonaws.com/prod/retrieve"
    }
  }
}

# API Gateway
resource "aws_api_gateway_rest_api" "nba_prediction_api" {
  name        = "nba-prediction-api${local.name_suffix}" # name in API Gateway
  description = "API Gateway for NBA Prediction Lambda"
  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# API Gateway Resource for Scrape
resource "aws_api_gateway_resource" "scrape" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  parent_id   = aws_api_gateway_rest_api.nba_prediction_api.root_resource_id
  path_part   = "scrape${local.name_suffix}"
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
  path_part   = "retrieve${local.name_suffix}"
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
  path_part   = "analyse${local.name_suffix}"
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
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# API Gateway Method for OPTIONS (CORS) - Retrieve endpoint
resource "aws_api_gateway_method" "retrieve_options_method" {
  rest_api_id   = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id   = aws_api_gateway_resource.retrieve.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# API Gateway Integration for OPTIONS (CORS) - Retrieve endpoint
resource "aws_api_gateway_integration" "retrieve_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id = aws_api_gateway_resource.retrieve.id
  http_method = aws_api_gateway_method.retrieve_options_method.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

# API Gateway Method Response for OPTIONS (CORS) - Retrieve endpoint
resource "aws_api_gateway_method_response" "retrieve_options_response" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id = aws_api_gateway_resource.retrieve.id
  http_method = aws_api_gateway_method.retrieve_options_method.http_method
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

# API Gateway Integration Response for OPTIONS (CORS) - Retrieve endpoint
resource "aws_api_gateway_integration_response" "retrieve_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id = aws_api_gateway_resource.retrieve.id
  http_method = aws_api_gateway_method.retrieve_options_method.http_method
  status_code = aws_api_gateway_method_response.retrieve_options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
# Add OPTIONS method for CORS preflight requests
resource "aws_api_gateway_method" "analyse_options_method" {
  rest_api_id   = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id   = aws_api_gateway_resource.analyse.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# Mock integration for OPTIONS method
resource "aws_api_gateway_integration" "analyse_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id = aws_api_gateway_resource.analyse.id
  http_method = aws_api_gateway_method.analyse_options_method.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# Method response for OPTIONS
resource "aws_api_gateway_method_response" "analyse_method_response" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id = aws_api_gateway_resource.analyse.id
  http_method = aws_api_gateway_method.analyse_options_method.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

# Integration response
resource "aws_api_gateway_integration_response" "analyse_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  resource_id = aws_api_gateway_resource.analyse.id
  http_method = aws_api_gateway_method.analyse_options_method.http_method
  status_code = aws_api_gateway_method_response.analyse_method_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
  }

  # This is needed to match the AWS_PROXY integration
  response_templates = {
    "application/json" = ""
  }

  depends_on = [
    aws_api_gateway_integration.analyse_integration,
    aws_api_gateway_method_response.analyse_method_response
  ]
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "nba_prediction_deployment" {
  rest_api_id = aws_api_gateway_rest_api.nba_prediction_api.id
  depends_on = [
    aws_api_gateway_integration.scrape_integration,
    aws_api_gateway_integration.retrieve_integration,
    aws_api_gateway_integration.analyse_integration,
    aws_api_gateway_integration_response.scrape_options_integration_response,
    aws_api_gateway_integration_response.retrieve_options_integration_response,
    aws_api_gateway_integration_response.analyse_options_integration_response
  ]
}

# API Gateway Stage
resource "aws_api_gateway_stage" "nba_prediction_stage" {
  stage_name    = local.environment == "default" ? "prod" : local.environment
  rest_api_id   = aws_api_gateway_rest_api.nba_prediction_api.id
  deployment_id = aws_api_gateway_deployment.nba_prediction_deployment.id
}

# CloudWatch Dashboard for monitoring Lambda functions
resource "aws_cloudwatch_dashboard" "nba_api_dashboard" {
  dashboard_name = "nba-api-dashboard${local.name_suffix}"
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.nba_scraper_lambda.function_name],
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.nba_retriever_lambda.function_name],
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.nba_analyse_lambda.function_name]
          ],
          period = 300,
          stat   = "Sum",
          region = var.aws_region,
          title  = "Lambda Invocations"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.nba_scraper_lambda.function_name],
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.nba_retriever_lambda.function_name],
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.nba_analyse_lambda.function_name]
          ],
          period = 300,
          stat   = "Sum",
          region = var.aws_region,
          title  = "Lambda Errors"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.nba_scraper_lambda.function_name],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.nba_retriever_lambda.function_name],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.nba_analyse_lambda.function_name]
          ],
          period = 300,
          stat   = "Average",
          region = var.aws_region,
          title  = "Lambda Duration (ms)"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", aws_api_gateway_rest_api.nba_prediction_api.name]
          ],
          period = 300,
          stat   = "Sum",
          region = var.aws_region,
          title  = "API Requests"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "4XXError", "ApiName", aws_api_gateway_rest_api.nba_prediction_api.name],
            ["AWS/ApiGateway", "5XXError", "ApiName", aws_api_gateway_rest_api.nba_prediction_api.name]
          ],
          period = 300,
          stat   = "Sum",
          region = var.aws_region,
          title  = "API Errors"
        }
      }
    ]
  })
}

# CloudWatch Alarm for Lambda Errors
resource "aws_cloudwatch_metric_alarm" "lambda_error_alarm" {
  for_each = {
    scraper   = aws_lambda_function.nba_scraper_lambda.function_name
    retriever = aws_lambda_function.nba_retriever_lambda.function_name
    analyser  = aws_lambda_function.nba_analyse_lambda.function_name
  }

  alarm_name          = "${each.value}-error-alarm${local.name_suffix}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This alarm monitors for errors in the ${each.value} function"
  alarm_actions       = [aws_sns_topic.lambda_alerts.arn]

  dimensions = {
    FunctionName = each.value
  }
}

# CloudWatch Alarm for API Gateway 5XX Errors
resource "aws_cloudwatch_metric_alarm" "api_5xx_error_alarm" {
  alarm_name          = "api-5xx-error-alarm${local.name_suffix}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This alarm monitors for 5XX errors in the API Gateway"
  alarm_actions       = [aws_sns_topic.lambda_alerts.arn]

  dimensions = {
    ApiName = aws_api_gateway_rest_api.nba_prediction_api.name
  }
}

# SNS Topic for Alerts
resource "aws_sns_topic" "lambda_alerts" {
  name = "nba-lambda-alerts${local.name_suffix}"
  fifo_topic         = false
  content_based_deduplication = false
}

# CloudWatch Log Groups with Retention Policy
resource "aws_cloudwatch_log_group" "scraper_logs" {
  name              = "/aws/lambda/${aws_lambda_function.nba_scraper_lambda.function_name}"
  retention_in_days = 14
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [tags, kms_key_id]
  }
}

resource "aws_cloudwatch_log_group" "retriever_logs" {
  name              = "/aws/lambda/${aws_lambda_function.nba_retriever_lambda.function_name}"
  retention_in_days = 14
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [tags, kms_key_id]
  }
}

resource "aws_cloudwatch_log_group" "analyser_logs" {
  name              = "/aws/lambda/${aws_lambda_function.nba_analyse_lambda.function_name}"
  retention_in_days = 14
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [tags, kms_key_id]
  }
}

# CloudWatch Logs Insights saved query
resource "aws_cloudwatch_query_definition" "lambda_error_query" {
  name = "NBA API Lambda Errors${local.name_suffix}"

  log_group_names = [
    aws_cloudwatch_log_group.scraper_logs.name,
    aws_cloudwatch_log_group.retriever_logs.name,
    aws_cloudwatch_log_group.analyser_logs.name
  ]

  query_string = <<EOF
fields @timestamp, @message
| filter @message like /Error/
| sort @timestamp desc
| limit 20
EOF
}

# CloudWatch Event Rule to trigger the scraper function daily
resource "aws_cloudwatch_event_rule" "daily_scraper_trigger" {
  name                = "daily-scraper-trigger${local.name_suffix}"
  description         = "Trigger the NBA scraper Lambda function daily (${local.environment})"
  schedule_expression = local.env_config.schedule
  event_bus_name      = "default"
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
  value = aws_api_gateway_stage.nba_prediction_stage.invoke_url
}
