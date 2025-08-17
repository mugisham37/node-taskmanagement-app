# Compute Module Outputs

output "ecs_cluster_id" {
  description = "ECS cluster ID"
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "load_balancer_arn" {
  description = "Application Load Balancer ARN"
  value       = aws_lb.main.arn
}

output "load_balancer_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = aws_lb.main.dns_name
}

output "load_balancer_zone_id" {
  description = "Application Load Balancer zone ID"
  value       = aws_lb.main.zone_id
}

output "api_target_group_arn" {
  description = "API target group ARN"
  value       = aws_lb_target_group.api.arn
}

output "web_target_group_arn" {
  description = "Web target group ARN"
  value       = aws_lb_target_group.web.arn
}

output "admin_target_group_arn" {
  description = "Admin target group ARN"
  value       = aws_lb_target_group.admin.arn
}

output "ecs_security_group_id" {
  description = "ECS tasks security group ID"
  value       = aws_security_group.ecs_tasks.id
}

output "alb_security_group_id" {
  description = "ALB security group ID"
  value       = aws_security_group.alb.id
}

output "ecs_task_execution_role_arn" {
  description = "ECS task execution role ARN"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_role_arn" {
  description = "ECS task role ARN"
  value       = aws_iam_role.ecs_task.arn
}

output "api_log_group_name" {
  description = "API CloudWatch log group name"
  value       = aws_cloudwatch_log_group.api.name
}

output "web_log_group_name" {
  description = "Web CloudWatch log group name"
  value       = aws_cloudwatch_log_group.web.name
}

output "admin_log_group_name" {
  description = "Admin CloudWatch log group name"
  value       = aws_cloudwatch_log_group.admin.name
}