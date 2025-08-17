# Security Module Variables

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where security resources will be created"
  type        = string
}

variable "load_balancer_arn" {
  description = "Load balancer ARN for WAF association"
  type        = string
}

variable "s3_bucket_arn" {
  description = "S3 bucket ARN for IAM policies"
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption"
  type        = string
  default     = ""
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# WAF Configuration
variable "rate_limit_per_5min" {
  description = "Rate limit per 5 minutes for WAF"
  type        = number
  default     = 2000
}

variable "blocked_countries" {
  description = "List of country codes to block"
  type        = list(string)
  default     = []
}

# Database Credentials
variable "database_username" {
  description = "Database username"
  type        = string
  sensitive   = true
}

variable "database_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "database_host" {
  description = "Database host"
  type        = string
}

variable "database_port" {
  description = "Database port"
  type        = number
  default     = 5432
}

variable "database_name" {
  description = "Database name"
  type        = string
}

# Redis Credentials
variable "redis_host" {
  description = "Redis host"
  type        = string
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "redis_auth_token" {
  description = "Redis auth token"
  type        = string
  sensitive   = true
}

# JWT Configuration
variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
}

variable "jwt_refresh_secret" {
  description = "JWT refresh secret key"
  type        = string
  sensitive   = true
}

# Certificate Configuration
variable "domain_name" {
  description = "Primary domain name for certificate"
  type        = string
}

variable "subject_alternative_names" {
  description = "Subject alternative names for certificate"
  type        = list(string)
  default     = []
}

# Bastion Configuration
variable "enable_bastion" {
  description = "Enable bastion host"
  type        = bool
  default     = false
}

variable "bastion_allowed_cidrs" {
  description = "CIDR blocks allowed to access bastion"
  type        = list(string)
  default     = []
}

# Security Services
variable "enable_guardduty" {
  description = "Enable GuardDuty"
  type        = bool
  default     = true
}

variable "enable_config" {
  description = "Enable AWS Config"
  type        = bool
  default     = false
}

variable "config_s3_bucket_name" {
  description = "S3 bucket name for Config"
  type        = string
  default     = ""
}

variable "enable_cloudtrail" {
  description = "Enable CloudTrail"
  type        = bool
  default     = false
}

variable "cloudtrail_s3_bucket_name" {
  description = "S3 bucket name for CloudTrail"
  type        = string
  default     = ""
}