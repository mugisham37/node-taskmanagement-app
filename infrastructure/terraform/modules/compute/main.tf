# Compute Module - ECS, EC2, Lambda
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.environment}-taskmanagement-cluster"
  
  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      
      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-cluster"
  })
}

# ECS Capacity Provider
resource "aws_ecs_capacity_provider" "fargate" {
  name = "${var.environment}-taskmanagement-fargate"
  
  fargate_capacity_provider {
    fargate_base = 1
    fargate_weight = 100
  }
  
  tags = var.common_tags
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name
  
  capacity_providers = [aws_ecs_capacity_provider.fargate.name]
  
  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = aws_ecs_capacity_provider.fargate.name
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.environment}-taskmanagement-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets           = var.public_subnet_ids
  
  enable_deletion_protection = var.environment == "production"
  
  access_logs {
    bucket  = var.alb_logs_bucket
    prefix  = "${var.environment}-taskmanagement-alb"
    enabled = true
  }
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-alb"
  })
}

# Target Groups
resource "aws_lb_target_group" "api" {
  name     = "${var.environment}-taskmanagement-api-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  target_type = "ip"
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-api-tg"
  })
}

resource "aws_lb_target_group" "web" {
  name     = "${var.environment}-taskmanagement-web-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  target_type = "ip"
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-web-tg"
  })
}

resource "aws_lb_target_group" "admin" {
  name     = "${var.environment}-taskmanagement-admin-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  target_type = "ip"
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-admin-tg"
  })
}

# ALB Listeners
resource "aws_lb_listener" "main" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.ssl_certificate_arn
  
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.main.arn
  priority     = 100
  
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
  
  condition {
    path_pattern {
      values = ["/api/*", "/trpc/*"]
    }
  }
}

resource "aws_lb_listener_rule" "admin" {
  listener_arn = aws_lb_listener.main.arn
  priority     = 200
  
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.admin.arn
  }
  
  condition {
    host_header {
      values = ["admin.${var.domain_name}"]
    }
  }
}

# HTTP to HTTPS redirect
resource "aws_lb_listener" "redirect" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"
  
  default_action {
    type = "redirect"
    
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Security Groups
resource "aws_security_group" "alb" {
  name_prefix = "${var.environment}-taskmanagement-alb-"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-alb-sg"
  })
}

resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${var.environment}-taskmanagement-ecs-tasks-"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-taskmanagement-ecs-tasks-sg"
  })
}

# IAM Roles
resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.environment}-taskmanagement-ecs-task-execution"
  
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

resource "aws_iam_role" "ecs_task" {
  name = "${var.environment}-taskmanagement-ecs-task"
  
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

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/aws/ecs/${var.environment}-taskmanagement-exec"
  retention_in_days = var.log_retention_days
  
  tags = var.common_tags
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/ecs/${var.environment}-taskmanagement-api"
  retention_in_days = var.log_retention_days
  
  tags = var.common_tags
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/aws/ecs/${var.environment}-taskmanagement-web"
  retention_in_days = var.log_retention_days
  
  tags = var.common_tags
}

resource "aws_cloudwatch_log_group" "admin" {
  name              = "/aws/ecs/${var.environment}-taskmanagement-admin"
  retention_in_days = var.log_retention_days
  
  tags = var.common_tags
}

# Auto Scaling
resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${var.environment}-taskmanagement-api"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ecs_policy_up" {
  name               = "${var.environment}-taskmanagement-scale-up"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace
  
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    
    target_value = 70.0
  }
}