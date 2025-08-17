# Database Module Outputs

output "postgresql_endpoint" {
  description = "PostgreSQL database endpoint"
  value       = aws_db_instance.postgresql.endpoint
}

output "postgresql_port" {
  description = "PostgreSQL database port"
  value       = aws_db_instance.postgresql.port
}

output "postgresql_database_name" {
  description = "PostgreSQL database name"
  value       = aws_db_instance.postgresql.db_name
}

output "postgresql_username" {
  description = "PostgreSQL database username"
  value       = aws_db_instance.postgresql.username
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_port" {
  description = "Redis cluster port"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_auth_token" {
  description = "Redis auth token"
  value       = aws_elasticache_replication_group.redis.auth_token
  sensitive   = true
}

output "database_security_group_id" {
  description = "Database security group ID"
  value       = aws_security_group.database.id
}

output "redis_security_group_id" {
  description = "Redis security group ID"
  value       = aws_security_group.redis.id
}

output "database_subnet_group_name" {
  description = "Database subnet group name"
  value       = aws_db_subnet_group.database.name
}

output "redis_subnet_group_name" {
  description = "Redis subnet group name"
  value       = aws_elasticache_subnet_group.redis.name
}