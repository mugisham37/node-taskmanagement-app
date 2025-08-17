# Networking Module Outputs

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "VPC CIDR block"
  value       = aws_vpc.main.cidr_block
}

output "internet_gateway_id" {
  description = "Internet Gateway ID"
  value       = aws_internet_gateway.main.id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "List of database subnet IDs"
  value       = aws_subnet.database[*].id
}

output "nat_gateway_ids" {
  description = "List of NAT Gateway IDs"
  value       = aws_nat_gateway.main[*].id
}

output "public_route_table_id" {
  description = "Public route table ID"
  value       = aws_route_table.public.id
}

output "private_route_table_ids" {
  description = "List of private route table IDs"
  value       = aws_route_table.private[*].id
}

output "database_route_table_id" {
  description = "Database route table ID"
  value       = aws_route_table.database.id
}

output "vpc_endpoint_security_group_id" {
  description = "VPC endpoint security group ID"
  value       = aws_security_group.vpc_endpoint.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.main[0].id : null
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.main[0].domain_name : null
}

output "cloudfront_hosted_zone_id" {
  description = "CloudFront distribution hosted zone ID"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.main[0].hosted_zone_id : null
}

# VPC Endpoint outputs
output "s3_vpc_endpoint_id" {
  description = "S3 VPC endpoint ID"
  value       = aws_vpc_endpoint.s3.id
}

output "ecr_dkr_vpc_endpoint_id" {
  description = "ECR DKR VPC endpoint ID"
  value       = aws_vpc_endpoint.ecr_dkr.id
}

output "ecr_api_vpc_endpoint_id" {
  description = "ECR API VPC endpoint ID"
  value       = aws_vpc_endpoint.ecr_api.id
}

output "logs_vpc_endpoint_id" {
  description = "CloudWatch Logs VPC endpoint ID"
  value       = aws_vpc_endpoint.logs.id
}