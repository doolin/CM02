variable "custom_domain" {
  description = "Custom domain name (e.g. forms.example.gov). Leave empty to skip."
  type        = string
  default     = ""
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID for the custom domain"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for the custom domain (must be in us-east-1 for API Gateway)"
  type        = string
  default     = ""
}

# ---------------------------------------------------------------------
# Custom domain (only created when custom_domain is set)
# ---------------------------------------------------------------------

resource "aws_apigatewayv2_domain_name" "custom" {
  count       = var.custom_domain != "" ? 1 : 0
  domain_name = var.custom_domain

  domain_name_configuration {
    certificate_arn = var.acm_certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "custom" {
  count       = var.custom_domain != "" ? 1 : 0
  api_id      = aws_apigatewayv2_api.cm02.id
  domain_name = aws_apigatewayv2_domain_name.custom[0].domain_name
  stage       = aws_apigatewayv2_stage.default.id
}

resource "aws_route53_record" "custom" {
  count   = var.custom_domain != "" && var.hosted_zone_id != "" ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = var.custom_domain
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.custom[0].domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.custom[0].domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

output "custom_domain_url" {
  description = "Custom domain URL (if configured)"
  value       = var.custom_domain != "" ? "https://${var.custom_domain}" : "N/A - using API Gateway default URL"
}
