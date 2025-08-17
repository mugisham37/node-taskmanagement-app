# Compute Module Variables

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where compute resources will be created"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for load balancer"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Load Balancer Configuration
variable "ssl_certificate_arn" {
  description = "ARN of SSL certificate for HTTPS listener"
  type        = string
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
}

variable "alb_logs_bucket" {
  description = "S3 bucket for ALB access logs"
  type        = string
}

# ECS Configuration
variable "min_capacity" {
  description = "Minimum number of ECS tasks"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of ECS tasks"
  type        = number
  default     = 10
}

# Monitoring Configuration
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

# Container Configuration
variable "api_image" {
  description = "Docker image for API service"
  type        = string
  default     = "taskmanagement/api:latest"
}

variable "web_image" {
  description = "Docker image for web service"
  type        = string
  default     = "taskmanagement/web:latest"
}

variable "admin_image" {
  description = "Docker image for admin service"
  type        = string
  default     = "taskmanagement/admin:latest"
}

variable "cpu" {
  description = "CPU units for ECS tasks"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Memory for ECS tasks"
  type        = number
  default     = 512
}

# Environment Variables
variable "database_url" {
  description = "Database connection URL"
  type        = string
  sensitive   = true
}

variable "redis_url" {
  description = "Redis connection URL"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
}

variable "app_environment" {
  description = "Application environment (development, staging, production)"
  type        = string
}