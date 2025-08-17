# Monitoring Module Outputs

output "cloudwatch_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "sns_topic_arn" {
  description = "SNS topic ARN for alerts"
  value       = aws_sns_topic.alerts.arn
}

output "application_log_group_name" {
  description = "Application log group name"
  value       = aws_cloudwatch_log_group.application.name
}

output "access_log_group_name" {
  description = "Access log group name"
  value       = aws_cloudwatch_log_group.access.name
}

output "error_log_group_name" {
  description = "Error log group name"
  value       = aws_cloudwatch_log_group.error.name
}

output "high_cpu_alarm_arn" {
  description = "High CPU alarm ARN"
  value       = aws_cloudwatch_metric_alarm.high_cpu.arn
}

output "high_memory_alarm_arn" {
  description = "High memory alarm ARN"
  value       = aws_cloudwatch_metric_alarm.high_memory.arn
}

output "high_response_time_alarm_arn" {
  description = "High response time alarm ARN"
  value       = aws_cloudwatch_metric_alarm.high_response_time.arn
}

output "high_error_rate_alarm_arn" {
  description = "High error rate alarm ARN"
  value       = aws_cloudwatch_metric_alarm.high_error_rate.arn
}

output "database_cpu_alarm_arn" {
  description = "Database CPU alarm ARN"
  value       = aws_cloudwatch_metric_alarm.database_cpu.arn
}

output "system_health_alarm_arn" {
  description = "System health composite alarm ARN"
  value       = aws_cloudwatch_composite_alarm.system_health.arn
}

output "xray_sampling_rule_arn" {
  description = "X-Ray sampling rule ARN"
  value       = aws_xray_sampling_rule.main.arn
}