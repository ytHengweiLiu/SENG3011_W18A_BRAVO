provider "aws" {
  region = "us-east-1"
  profile = "LambdaDeploy"
}

resource "aws_lambda_function" "nba_stat_comparator" {
  function_name = "nba_stat_comparator"
  runtime       = "python3.9"
  handler       = "lambda_function.lambda_handler"
  filename      = "lambda_function.zip"
  role          = aws_iam_role.lambda_exec.arn
  source_code_hash = filebase64sha256("lambda_function.zip")
}

resource "aws_iam_role" "lambda_exec" {
  name = "lambda_analytic_model"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.nba_stat_comparator.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.nba_api.execution_arn}/*/*"
}

resource "aws_api_gateway_rest_api" "nba_api" {
  name        = "NBAStatsAPI"
  description = "API for comparing NBA team stats"
}

resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.nba_api.id
  parent_id   = aws_api_gateway_rest_api.nba_api.root_resource_id
  path_part   = "compare"
}

resource "aws_api_gateway_method" "post" {
  rest_api_id   = aws_api_gateway_rest_api.nba_api.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = aws_api_gateway_rest_api.nba_api.id
  resource_id = aws_api_gateway_method.post.resource_id
  http_method = aws_api_gateway_method.post.http_method
  integration_http_method = "POST"
  type        = "AWS_PROXY"
  uri         = aws_lambda_function.nba_stat_comparator.invoke_arn
}

resource "aws_api_gateway_deployment" "nba_api" {
  depends_on = [aws_api_gateway_integration.lambda]
  rest_api_id = aws_api_gateway_rest_api.nba_api.id
}

resource "aws_api_gateway_stage" "prod" {
  stage_name    = "prod"
  rest_api_id   = aws_api_gateway_rest_api.nba_api.id
  deployment_id = aws_api_gateway_deployment.nba_api.id
}

output "lambda_arn" {
  value = aws_lambda_function.nba_stat_comparator.arn
}

output "api_url" {
  value = "${aws_api_gateway_deployment.nba_api.invoke_url}${aws_api_gateway_stage.prod.stage_name}"
}