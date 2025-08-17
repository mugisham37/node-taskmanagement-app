# Terraform configuration for dev environment

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    # Configure your S3 backend here
    # bucket = "your-terraform-state-bucket"
    # key    = "taskmanagement/dev/terraform.tfstate"
    # region = "us-west-2"
  }
}

# Provider configuration
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment = "dev"
      Project     = "TaskManagement"
      ManagedBy   = "Terraform"
    }
  }
}

# Module configurations
module "networking" {
  source = "../../modules/networking"
  
  environment = "dev"
  vpc_cidr    = var.vpc_cidr
  
  enable_nat_gateway = false  # Cost optimization for dev
  enable_cloudfront  = false  # Not needed for dev
  
  common_tags = local.common_tags
}

module "database" {
  source = "../../modules/database"
  
  environment         = "dev"
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  app_security_group_id = module.compute.ecs_security_group_id
  
  # Dev-specific database configuration
  postgres_instance_class = "db.t3.micro"
  postgres_allocated_storage = 20
  backup_retention_period = 1
  
  redis_node_type = "cache.t3.micro"
  redis_num_cache_nodes = 1
  
  database_password = var.database_password
  redis_auth_token  = var.redis_auth_token
  
  common_tags = local.common_tags
}

module "compute" {
  source = "../../modules/compute"
  
  environment          = "dev"
  vpc_id              = module.networking.vpc_id
  public_subnet_ids   = module.networking.public_subnet_ids
  private_subnet_ids  = module.networking.private_subnet_ids
  
  # Dev-specific compute configuration
  min_capacity = 1
  max_capacity = 3
  cpu = 256
  memory = 512
  
  ssl_certificate_arn = var.ssl_certificate_arn
  domain_name        = var.domain_name
  alb_logs_bucket    = module.storage.alb_logs_bucket_id
  
  database_url = "postgresql://${module.database.postgresql_username}:${var.database_password}@${module.database.postgresql_endpoint}/${module.database.postgresql_database_name}"
  redis_url    = "redis://:${var.redis_auth_token}@${module.database.redis_endpoint}:${module.database.redis_port}"
  jwt_secret   = var.jwt_secret
  app_environment = "development"
  
  common_tags = local.common_tags
}

module "storage" {
  source = "../../modules/storage"
  
  environment         = "dev"
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  app_security_group_id = module.compute.ecs_security_group_id
  
  # Dev-specific storage configuration
  backup_retention_days = 30
  alb_logs_retention_days = 30
  efs_performance_mode = "generalPurpose"
  efs_throughput_mode = "bursting"
  
  common_tags = local.common_tags
}

module "monitoring" {
  source = "../../modules/monitoring"
  
  environment = "dev"
  
  ecs_cluster_name = module.compute.ecs_cluster_name
  load_balancer_arn_suffix = split("/", module.compute.load_balancer_arn)[1]
  database_instance_id = split(":", module.database.postgresql_endpoint)[0]
  redis_cluster_id = module.database.redis_endpoint
  
  alert_email_addresses = var.alert_email_addresses
  log_retention_days = 7  # Shorter retention for dev
  
  common_tags = local.common_tags
}

module "security" {
  source = "../../modules/security"
  
  environment = "dev"
  vpc_id = module.networking.vpc_id
  load_balancer_arn = module.compute.load_balancer_arn
  s3_bucket_arn = module.storage.app_assets_bucket_arn
  
  # Database credentials
  database_username = module.database.postgresql_username
  database_password = var.database_password
  database_host = module.database.postgresql_endpoint
  database_name = module.database.postgresql_database_name
  
  # Redis credentials
  redis_host = module.database.redis_endpoint
  redis_auth_token = var.redis_auth_token
  
  # JWT configuration
  jwt_secret = var.jwt_secret
  jwt_refresh_secret = var.jwt_refresh_secret
  
  # Certificate configuration
  domain_name = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  
  # Dev-specific security configuration
  rate_limit_per_5min = 1000  # More lenient for dev
  enable_guardduty = false    # Cost optimization
  enable_config = false       # Cost optimization
  enable_cloudtrail = false   # Cost optimization
  
  common_tags = local.common_tags
}

# Local values
locals {
  common_tags = {
    Environment = "dev"
    Project     = "TaskManagement"
    ManagedBy   = "Terraform"
  }
}