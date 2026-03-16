variable "aws_region" {
  default = "us-west-1"
}

variable "lambda_function_name" {
  default = "cm02-baseline-configuration"
}

variable "github_org" {
  description = "GitHub organization for OIDC trust"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name for OIDC trust"
  type        = string
}

# ---------------------------------------------------------------------
# Lambda execution role
# ---------------------------------------------------------------------

resource "aws_iam_role" "cm02_lambda_role" {
  name = "${var.lambda_function_name}-role"

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

resource "aws_iam_role_policy_attachment" "cm02_basic_execution" {
  role       = aws_iam_role.cm02_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# S3 artifact policy attachment is managed in form-terra, where
# the inventium-artifacts bucket and its IAM policy are defined.

# ---------------------------------------------------------------------
# Lambda function
# ---------------------------------------------------------------------

resource "aws_lambda_function" "cm02" {
  function_name = var.lambda_function_name
  role          = aws_iam_role.cm02_lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/../deployment.zip"
  source_code_hash = filebase64sha256("${path.module}/../deployment.zip")
}

# ---------------------------------------------------------------------
# HTTP API Gateway
# ---------------------------------------------------------------------

resource "aws_apigatewayv2_api" "cm02" {
  name          = var.lambda_function_name
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["Content-Type"]
  }
}

resource "aws_apigatewayv2_integration" "cm02" {
  api_id                 = aws_apigatewayv2_api.cm02.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.cm02.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get" {
  api_id    = aws_apigatewayv2_api.cm02.id
  route_key = "GET /"
  target    = "integrations/${aws_apigatewayv2_integration.cm02.id}"
}

resource "aws_apigatewayv2_route" "post" {
  api_id    = aws_apigatewayv2_api.cm02.id
  route_key = "POST /api/cm02"
  target    = "integrations/${aws_apigatewayv2_integration.cm02.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.cm02.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cm02.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.cm02.execution_arn}/*"
}

# ---------------------------------------------------------------------
# GitHub Actions OIDC deploy role
# ---------------------------------------------------------------------

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_role" "github_deploy" {
  name = "${var.lambda_function_name}-github-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = data.aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/master"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_deploy_lambda" {
  name = "lambda-deploy"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:UpdateFunctionCode",
          "lambda:GetFunction",
          "lambda:InvokeFunction",
        ]
        Resource = aws_lambda_function.cm02.arn
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:GetFunctionConfiguration",
        ]
        Resource = aws_lambda_function.cm02.arn
      },
    ]
  })
}

# ---------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------

output "api_endpoint" {
  description = "URL to open in your browser"
  value       = aws_apigatewayv2_api.cm02.api_endpoint
}

output "lambda_function_name" {
  value = aws_lambda_function.cm02.function_name
}

output "github_deploy_role_arn" {
  description = "Set this as AWS_DEPLOY_ROLE_ARN in GitHub Secrets"
  value       = aws_iam_role.github_deploy.arn
}
