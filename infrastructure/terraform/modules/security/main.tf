# Security Module - IAM, Security Groups, WAF
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# WAF Web ACL
resource "aws_wafv2_web_acl" "main" {
  name  = "${var.environment}-taskmanagement-waf"
  scope = "REGIONAL"
  
  default_action {
    allow {}
  }
  
  # AWS Managed Rules - Core Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1
    
    override_action {
      none {}
    }
    
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }
  
  # AWS Managed Rules - Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2
    
    override_action {
      none {}
    }
    
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "KnownBadInputsRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }
  
  # Rate Limiting Rule
  rule {
    name     = "RateLimitRule"
    priority = 3
    
    action {
      block {}
    }
    
    statement {
      rate_based_statement {
        limit              = var.rate_limit_per_5min
        aggregate_key_type = "IP"
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRuleMetric"
      sampled_requests_enabled   = true
    }
  }
  
  # Geo Blocking Rule (if enabled)
  dynamic "rule" {
    for_each = length(var.blocked_countries) > 0 ? [1] : []
    content {
      name     = "GeoBlockingRule"
      priority = 4
      
      action {
        block {}
      }
      
      statement {
        geo_match_statement {
          country_codes = var.blocked_countries
        }
      }
      
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "GeoBlockingRuleMetric"
        sampled_requests_enabled   = true
      }
    }
  }
  
  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.environment}TaskManagementWAF"
    sampled_requests_enabled   = true
  }
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-waf"
  })
}

# WAF Association with ALB
resource "aws_wafv2_web_acl_association" "main" {
  resource_arn = var.load_balancer_arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.environment}-taskmanagement-ecs-execution-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
  
  tags = var.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Custom IAM Policy for ECS Task Execution
resource "aws_iam_policy" "ecs_task_execution_custom" {
  name        = "${var.environment}-taskmanagement-ecs-execution-custom"
  description = "Custom policy for ECS task execution"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "kms:Decrypt"
        ]
        Resource = [
          aws_secretsmanager_secret.database_credentials.arn,
          aws_secretsmanager_secret.redis_credentials.arn,
          aws_secretsmanager_secret.jwt_secret.arn,
          var.kms_key_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
  
  tags = var.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_custom" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = aws_iam_policy.ecs_task_execution_custom.arn
}

# IAM Role for ECS Tasks
resource "aws_iam_role" "ecs_task" {
  name = "${var.environment}-taskmanagement-ecs-task-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
  
  tags = var.common_tags
}

# Custom IAM Policy for ECS Tasks
resource "aws_iam_policy" "ecs_task_custom" {
  name        = "${var.environment}-taskmanagement-ecs-task-custom"
  description = "Custom policy for ECS tasks"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${var.s3_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = [
          var.s3_bucket_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
  
  tags = var.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_custom" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = aws_iam_policy.ecs_task_custom.arn
}

# Secrets Manager
resource "aws_secretsmanager_secret" "database_credentials" {
  name                    = "${var.environment}-taskmanagement-database-credentials"
  description             = "Database credentials for ${var.environment} environment"
  recovery_window_in_days = var.environment == "production" ? 30 : 0
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-database-credentials"
  })
}

resource "aws_secretsmanager_secret_version" "database_credentials" {
  secret_id = aws_secretsmanager_secret.database_credentials.id
  secret_string = jsonencode({
    username = var.database_username
    password = var.database_password
    host     = var.database_host
    port     = var.database_port
    dbname   = var.database_name
  })
}

resource "aws_secretsmanager_secret" "redis_credentials" {
  name                    = "${var.environment}-taskmanagement-redis-credentials"
  description             = "Redis credentials for ${var.environment} environment"
  recovery_window_in_days = var.environment == "production" ? 30 : 0
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-redis-credentials"
  })
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = aws_secretsmanager_secret.redis_credentials.id
  secret_string = jsonencode({
    host      = var.redis_host
    port      = var.redis_port
    auth_token = var.redis_auth_token
  })
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${var.environment}-taskmanagement-jwt-secret"
  description             = "JWT secret for ${var.environment} environment"
  recovery_window_in_days = var.environment == "production" ? 30 : 0
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-jwt-secret"
  })
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id = aws_secretsmanager_secret.jwt_secret.id
  secret_string = jsonencode({
    jwt_secret = var.jwt_secret
    jwt_refresh_secret = var.jwt_refresh_secret
  })
}

# Security Groups
resource "aws_security_group" "bastion" {
  count = var.enable_bastion ? 1 : 0
  
  name_prefix = "${var.environment}-taskmanagement-bastion-"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.bastion_allowed_cidrs
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-bastion-sg"
  })
}

# KMS Key for Encryption
resource "aws_kms_key" "main" {
  description             = "KMS key for ${var.environment} taskmanagement encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow ECS Task Role"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ecs_task.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-kms-key"
  })
}

resource "aws_kms_alias" "main" {
  name          = "alias/${var.environment}-taskmanagement"
  target_key_id = aws_kms_key.main.key_id
}

# Certificate Manager
resource "aws_acm_certificate" "main" {
  domain_name               = var.domain_name
  subject_alternative_names = var.subject_alternative_names
  validation_method         = "DNS"
  
  lifecycle {
    create_before_destroy = true
  }
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-certificate"
  })
}

# GuardDuty (if enabled)
resource "aws_guardduty_detector" "main" {
  count = var.enable_guardduty ? 1 : 0
  
  enable = true
  
  datasources {
    s3_logs {
      enable = true
    }
    kubernetes {
      audit_logs {
        enable = true
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = true
        }
      }
    }
  }
  
  tags = var.common_tags
}

# Config (if enabled)
resource "aws_config_configuration_recorder" "main" {
  count = var.enable_config ? 1 : 0
  
  name     = "${var.environment}-taskmanagement-config-recorder"
  role_arn = aws_iam_role.config[0].arn
  
  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }
}

resource "aws_config_delivery_channel" "main" {
  count = var.enable_config ? 1 : 0
  
  name           = "${var.environment}-taskmanagement-config-delivery-channel"
  s3_bucket_name = var.config_s3_bucket_name
}

resource "aws_iam_role" "config" {
  count = var.enable_config ? 1 : 0
  
  name = "${var.environment}-taskmanagement-config-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
      }
    ]
  })
  
  tags = var.common_tags
}

resource "aws_iam_role_policy_attachment" "config" {
  count = var.enable_config ? 1 : 0
  
  role       = aws_iam_role.config[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/ConfigRole"
}

# Data sources
data "aws_caller_identity" "current" {}

# CloudTrail (if enabled)
resource "aws_cloudtrail" "main" {
  count = var.enable_cloudtrail ? 1 : 0
  
  name           = "${var.environment}-taskmanagement-cloudtrail"
  s3_bucket_name = var.cloudtrail_s3_bucket_name
  
  event_selector {
    read_write_type                 = "All"
    include_management_events       = true
    exclude_management_event_sources = []
    
    data_resource {
      type   = "AWS::S3::Object"
      values = ["${var.s3_bucket_arn}/*"]
    }
  }
  
  tags = var.common_tags
}