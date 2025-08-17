# Outputs for dev environment

output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "load_balancer_dns_name" {
  description = "Load balancer DNS name"
  value       = module.compute.load_balancer_dns_name
}

output "database_endpoint" {
  description = "Database endpoint"
  value       = module.database.postgresql_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.database.redis_endpoint
  sensitive   = true
}

output "s3_bucket_name" {
  description = "S3 bucket name for assets"
  value       = module.storage.app_assets_bucket_id
}

output "cloudwatch_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = module.monitoring.cloudwatch_dashboard_url
}

output "certificate_arn" {
  description = "SSL certificate ARN"
  value       = module.security.certificate_arn
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.compute.ecs_cluster_name
}