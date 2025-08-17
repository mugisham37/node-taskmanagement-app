# Monitoring Module Variables

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Resource Identifiers
variable "ecs_cluster_name" {
  description = "ECS cluster name for monitoring"
  type        = string
}

variable "load_balancer_arn_suffix" {
  description = "Load balancer ARN suffix for CloudWatch metrics"
  type        = string
}

variable "database_instance_id" {
  description = "RDS database instance ID for monitoring"
  type        = string
}

variable "redis_cluster_id" {
  description = "Redis cluster ID for monitoring"
  type        = string
}

# Alert Configuration
variable "alert_email_addresses" {
  description = "List of email addresses for alerts"
  type        = list(string)
  default     = []
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for alerts"
  type        = string
  default     = ""
  sensitive   = true
}

# Log Configuration
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

# Monitoring Thresholds
variable "cpu_threshold" {
  description = "CPU utilization threshold for alarms"
  type        = number
  default     = 80
}

variable "memory_threshold" {
  description = "Memory utilization threshold for alarms"
  type        = number
  default     = 80
}

variable "response_time_threshold" {
  description = "Response time threshold in seconds for alarms"
  type        = number
  default     = 2
}

variable "error_rate_threshold" {
  description = "Error rate threshold for alarms"
  type        = number
  default     = 10
}

variable "database_cpu_threshold" {
  description = "Database CPU utilization threshold for alarms"
  type        = number
  default     = 80
}