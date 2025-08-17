# Storage Module Variables

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where storage resources will be created"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for EFS mount targets"
  type        = list(string)
}

variable "app_security_group_id" {
  description = "Security group ID of the application servers"
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# S3 Configuration
variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 2555  # 7 years
}

variable "alb_logs_retention_days" {
  description = "Number of days to retain ALB logs"
  type        = number
  default     = 90
}

# EFS Configuration
variable "efs_performance_mode" {
  description = "EFS performance mode"
  type        = string
  default     = "generalPurpose"
  
  validation {
    condition = contains([
      "generalPurpose",
      "maxIO"
    ], var.efs_performance_mode)
    error_message = "EFS performance mode must be generalPurpose or maxIO."
  }
}

variable "efs_throughput_mode" {
  description = "EFS throughput mode"
  type        = string
  default     = "bursting"
  
  validation {
    condition = contains([
      "bursting",
      "provisioned"
    ], var.efs_throughput_mode)
    error_message = "EFS throughput mode must be bursting or provisioned."
  }
}

variable "efs_provisioned_throughput" {
  description = "EFS provisioned throughput in MiB/s (only used when throughput_mode is provisioned)"
  type        = number
  default     = 100
}

# Monitoring Configuration
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}