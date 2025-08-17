# Storage Module - S3, EFS
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# S3 Bucket for Application Assets
resource "aws_s3_bucket" "app_assets" {
  bucket = "${var.environment}-taskmanagement-assets-${random_id.bucket_suffix.hex}"
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-assets"
    Type = "Application Assets"
  })
}

resource "aws_s3_bucket_versioning" "app_assets" {
  bucket = aws_s3_bucket.app_assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "app_assets" {
  bucket = aws_s3_bucket.app_assets.id
  
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}

resource "aws_s3_bucket_public_access_block" "app_assets" {
  bucket = aws_s3_bucket.app_assets.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "app_assets" {
  bucket = aws_s3_bucket.app_assets.id
  
  rule {
    id     = "delete_old_versions"
    status = "Enabled"
    
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
  
  rule {
    id     = "transition_to_ia"
    status = "Enabled"
    
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

# S3 Bucket for Backups
resource "aws_s3_bucket" "backups" {
  bucket = "${var.environment}-taskmanagement-backups-${random_id.bucket_suffix.hex}"
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-backups"
    Type = "Backups"
  })
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "backups" {
  bucket = aws_s3_bucket.backups.id
  
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm     = "aws:kms"
        kms_master_key_id = aws_kms_key.backup_key.arn
      }
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  
  rule {
    id     = "backup_lifecycle"
    status = "Enabled"
    
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    
    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }
    
    expiration {
      days = var.backup_retention_days
    }
  }
}

# S3 Bucket for ALB Logs
resource "aws_s3_bucket" "alb_logs" {
  bucket = "${var.environment}-taskmanagement-alb-logs-${random_id.bucket_suffix.hex}"
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-alb-logs"
    Type = "ALB Logs"
  })
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_elb_service_account.main.id}:root"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/*"
      },
      {
        Effect = "Allow"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      },
      {
        Effect = "Allow"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.alb_logs.arn
      }
    ]
  })
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  
  rule {
    id     = "alb_logs_lifecycle"
    status = "Enabled"
    
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    
    expiration {
      days = var.alb_logs_retention_days
    }
  }
}

# EFS File System
resource "aws_efs_file_system" "main" {
  creation_token = "${var.environment}-taskmanagement-efs"
  
  performance_mode = var.efs_performance_mode
  throughput_mode  = var.efs_throughput_mode
  
  dynamic "provisioned_throughput_in_mibps" {
    for_each = var.efs_throughput_mode == "provisioned" ? [var.efs_provisioned_throughput] : []
    content {
      provisioned_throughput_in_mibps = provisioned_throughput_in_mibps.value
    }
  }
  
  encrypted = true
  kms_key_id = aws_kms_key.efs_key.arn
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-efs"
  })
}

# EFS Mount Targets
resource "aws_efs_mount_target" "main" {
  count = length(var.private_subnet_ids)
  
  file_system_id  = aws_efs_file_system.main.id
  subnet_id       = var.private_subnet_ids[count.index]
  security_groups = [aws_security_group.efs.id]
}

# EFS Access Points
resource "aws_efs_access_point" "app_data" {
  file_system_id = aws_efs_file_system.main.id
  
  posix_user {
    gid = 1000
    uid = 1000
  }
  
  root_directory {
    path = "/app-data"
    creation_info {
      owner_gid   = 1000
      owner_uid   = 1000
      permissions = "755"
    }
  }
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-app-data"
  })
}

resource "aws_efs_access_point" "uploads" {
  file_system_id = aws_efs_file_system.main.id
  
  posix_user {
    gid = 1000
    uid = 1000
  }
  
  root_directory {
    path = "/uploads"
    creation_info {
      owner_gid   = 1000
      owner_uid   = 1000
      permissions = "755"
    }
  }
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-uploads"
  })
}

# Security Group for EFS
resource "aws_security_group" "efs" {
  name_prefix = "${var.environment}-taskmanagement-efs-"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port       = 2049
    to_port         = 2049
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
    Name = "${var.environment}-taskmanagement-efs-sg"
  })
}

# KMS Keys
resource "aws_kms_key" "backup_key" {
  description             = "KMS key for ${var.environment} taskmanagement backups"
  deletion_window_in_days = 7
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-backup-key"
  })
}

resource "aws_kms_alias" "backup_key" {
  name          = "alias/${var.environment}-taskmanagement-backup"
  target_key_id = aws_kms_key.backup_key.key_id
}

resource "aws_kms_key" "efs_key" {
  description             = "KMS key for ${var.environment} taskmanagement EFS"
  deletion_window_in_days = 7
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-efs-key"
  })
}

resource "aws_kms_alias" "efs_key" {
  name          = "alias/${var.environment}-taskmanagement-efs"
  target_key_id = aws_kms_key.efs_key.key_id
}

# Random ID for bucket suffix
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# Data source for ELB service account
data "aws_elb_service_account" "main" {}

# CloudWatch Log Group for EFS
resource "aws_cloudwatch_log_group" "efs" {
  name              = "/aws/efs/${var.environment}-taskmanagement"
  retention_in_days = var.log_retention_days
  
  tags = var.common_tags
}

# EFS Backup Policy
resource "aws_efs_backup_policy" "main" {
  file_system_id = aws_efs_file_system.main.id
  
  backup_policy {
    status = "ENABLED"
  }
}

# S3 Bucket Notification for Backups
resource "aws_s3_bucket_notification" "backup_notification" {
  bucket = aws_s3_bucket.backups.id
  
  cloudwatch_configuration {
    cloudwatch_configuration_id = "backup-notification"
    events                     = ["s3:ObjectCreated:*"]
  }
}