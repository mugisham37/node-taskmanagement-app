# Security Module Outputs

output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN"
  value       = aws_wafv2_web_acl.main.arn
}

output "waf_web_acl_id" {
  description = "WAF Web ACL ID"
  value       = aws_wafv2_web_acl.main.id
}

output "ecs_task_execution_role_arn" {
  description = "ECS task execution role ARN"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_role_arn" {
  description = "ECS task role ARN"
  value       = aws_iam_role.ecs_task.arn
}

output "database_credentials_secret_arn" {
  description = "Database credentials secret ARN"
  value       = aws_secretsmanager_secret.database_credentials.arn
}

output "redis_credentials_secret_arn" {
  description = "Redis credentials secret ARN"
  value       = aws_secretsmanager_secret.redis_credentials.arn
}

output "jwt_secret_arn" {
  description = "JWT secret ARN"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "kms_key_id" {
  description = "KMS key ID"
  value       = aws_kms_key.main.key_id
}

output "kms_key_arn" {
  description = "KMS key ARN"
  value       = aws_kms_key.main.arn
}

output "kms_alias_name" {
  description = "KMS alias name"
  value       = aws_kms_alias.main.name
}

output "certificate_arn" {
  description = "ACM certificate ARN"
  value       = aws_acm_certificate.main.arn
}

output "certificate_domain_validation_options" {
  description = "Certificate domain validation options"
  value       = aws_acm_certificate.main.domain_validation_options
}

output "bastion_security_group_id" {
  description = "Bastion security group ID"
  value       = var.enable_bastion ? aws_security_group.bastion[0].id : null
}

output "guardduty_detector_id" {
  description = "GuardDuty detector ID"
  value       = var.enable_guardduty ? aws_guardduty_detector.main[0].id : null
}

output "config_recorder_name" {
  description = "Config recorder name"
  value       = var.enable_config ? aws_config_configuration_recorder.main[0].name : null
}

output "cloudtrail_arn" {
  description = "CloudTrail ARN"
  value       = var.enable_cloudtrail ? aws_cloudtrail.main[0].arn : null
}