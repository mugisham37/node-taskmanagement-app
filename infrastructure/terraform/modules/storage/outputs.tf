# Storage Module Outputs

# S3 Bucket Outputs
output "app_assets_bucket_id" {
  description = "Application assets S3 bucket ID"
  value       = aws_s3_bucket.app_assets.id
}

output "app_assets_bucket_arn" {
  description = "Application assets S3 bucket ARN"
  value       = aws_s3_bucket.app_assets.arn
}

output "app_assets_bucket_domain_name" {
  description = "Application assets S3 bucket domain name"
  value       = aws_s3_bucket.app_assets.bucket_domain_name
}

output "backups_bucket_id" {
  description = "Backups S3 bucket ID"
  value       = aws_s3_bucket.backups.id
}

output "backups_bucket_arn" {
  description = "Backups S3 bucket ARN"
  value       = aws_s3_bucket.backups.arn
}

output "alb_logs_bucket_id" {
  description = "ALB logs S3 bucket ID"
  value       = aws_s3_bucket.alb_logs.id
}

output "alb_logs_bucket_arn" {
  description = "ALB logs S3 bucket ARN"
  value       = aws_s3_bucket.alb_logs.arn
}

# EFS Outputs
output "efs_file_system_id" {
  description = "EFS file system ID"
  value       = aws_efs_file_system.main.id
}

output "efs_file_system_arn" {
  description = "EFS file system ARN"
  value       = aws_efs_file_system.main.arn
}

output "efs_dns_name" {
  description = "EFS DNS name"
  value       = aws_efs_file_system.main.dns_name
}

output "efs_app_data_access_point_id" {
  description = "EFS app data access point ID"
  value       = aws_efs_access_point.app_data.id
}

output "efs_app_data_access_point_arn" {
  description = "EFS app data access point ARN"
  value       = aws_efs_access_point.app_data.arn
}

output "efs_uploads_access_point_id" {
  description = "EFS uploads access point ID"
  value       = aws_efs_access_point.uploads.id
}

output "efs_uploads_access_point_arn" {
  description = "EFS uploads access point ARN"
  value       = aws_efs_access_point.uploads.arn
}

output "efs_security_group_id" {
  description = "EFS security group ID"
  value       = aws_security_group.efs.id
}

# KMS Key Outputs
output "backup_kms_key_id" {
  description = "Backup KMS key ID"
  value       = aws_kms_key.backup_key.key_id
}

output "backup_kms_key_arn" {
  description = "Backup KMS key ARN"
  value       = aws_kms_key.backup_key.arn
}

output "efs_kms_key_id" {
  description = "EFS KMS key ID"
  value       = aws_kms_key.efs_key.key_id
}

output "efs_kms_key_arn" {
  description = "EFS KMS key ARN"
  value       = aws_kms_key.efs_key.arn
}