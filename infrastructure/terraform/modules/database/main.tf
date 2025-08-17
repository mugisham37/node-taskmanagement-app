# Database Module - PostgreSQL and Redis
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# PostgreSQL RDS Instance
resource "aws_db_instance" "postgresql" {
  identifier = "${var.environment}-taskmanagement-postgres"
  
  engine         = "postgres"
  engine_version = var.postgres_version
  instance_class = var.postgres_instance_class
  
  allocated_storage     = var.postgres_allocated_storage
  max_allocated_storage = var.postgres_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  
  db_name  = var.database_name
  username = var.database_username
  password = var.database_password
  
  vpc_security_group_ids = [aws_security_group.database.id]
  db_subnet_group_name   = aws_db_subnet_group.database.name
  
  backup_retention_period = var.backup_retention_period
  backup_window          = var.backup_window
  maintenance_window     = var.maintenance_window
  
  skip_final_snapshot = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${var.environment}-taskmanagement-postgres-final-snapshot" : null
  
  performance_insights_enabled = var.environment == "production"
  monitoring_interval         = var.environment == "production" ? 60 : 0
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-postgres"
    Type = "Database"
  })
}

# Redis ElastiCache Cluster
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.environment}-taskmanagement-redis-subnet-group"
  subnet_ids = var.private_subnet_ids
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-redis-subnet-group"
  })
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.environment}-taskmanagement-redis"
  description                = "Redis cluster for ${var.environment} environment"
  
  node_type                  = var.redis_node_type
  port                       = 6379
  parameter_group_name       = "default.redis7"
  
  num_cache_clusters         = var.redis_num_cache_nodes
  automatic_failover_enabled = var.redis_num_cache_nodes > 1
  multi_az_enabled          = var.redis_num_cache_nodes > 1
  
  subnet_group_name = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = var.redis_auth_token
  
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-redis"
    Type = "Cache"
  })
}

# Database Subnet Group
resource "aws_db_subnet_group" "database" {
  name       = "${var.environment}-taskmanagement-db-subnet-group"
  subnet_ids = var.private_subnet_ids
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-db-subnet-group"
  })
}

# Security Groups
resource "aws_security_group" "database" {
  name_prefix = "${var.environment}-taskmanagement-db-"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-db-sg"
  })
}

resource "aws_security_group" "redis" {
  name_prefix = "${var.environment}-taskmanagement-redis-"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-redis-sg"
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "redis_slow" {
  name              = "/aws/elasticache/${var.environment}-taskmanagement-redis/slow-log"
  retention_in_days = var.log_retention_days
  
  tags = var.common_tags
}

# Database Parameter Group
resource "aws_db_parameter_group" "postgresql" {
  family = "postgres15"
  name   = "${var.environment}-taskmanagement-postgres-params"
  
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }
  
  parameter {
    name  = "log_statement"
    value = "all"
  }
  
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }
  
  tags = var.common_tags
}

# Database Monitoring
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${var.environment}-taskmanagement-db-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "120"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors db cpu utilization"
  
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgresql.id
  }
  
  tags = var.common_tags
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  alarm_name          = "${var.environment}-taskmanagement-db-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "120"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors db connections"
  
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgresql.id
  }
  
  tags = var.common_tags
}