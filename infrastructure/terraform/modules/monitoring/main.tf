# Monitoring Module - CloudWatch, Prometheus, Grafana
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.environment}-taskmanagement-dashboard"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.load_balancer_arn_suffix],
            [".", "TargetResponseTime", ".", "."],
            [".", "HTTPCode_Target_2XX_Count", ".", "."],
            [".", "HTTPCode_Target_4XX_Count", ".", "."],
            [".", "HTTPCode_Target_5XX_Count", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Application Load Balancer Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", "${var.environment}-taskmanagement-api", "ClusterName", var.ecs_cluster_name],
            [".", "MemoryUtilization", ".", ".", ".", "."],
            [".", "RunningTaskCount", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "ECS Service Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.database_instance_id],
            [".", "DatabaseConnections", ".", "."],
            [".", "ReadLatency", ".", "."],
            [".", "WriteLatency", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "RDS Database Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", var.redis_cluster_id],
            [".", "NetworkBytesIn", ".", "."],
            [".", "NetworkBytesOut", ".", "."],
            [".", "CurrConnections", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Redis Cache Metrics"
          period  = 300
        }
      }
    ]
  })
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "${var.environment}-taskmanagement-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    ServiceName = "${var.environment}-taskmanagement-api"
    ClusterName = var.ecs_cluster_name
  }
  
  tags = var.common_tags
}

resource "aws_cloudwatch_metric_alarm" "high_memory" {
  alarm_name          = "${var.environment}-taskmanagement-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS memory utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    ServiceName = "${var.environment}-taskmanagement-api"
    ClusterName = var.ecs_cluster_name
  }
  
  tags = var.common_tags
}

resource "aws_cloudwatch_metric_alarm" "high_response_time" {
  alarm_name          = "${var.environment}-taskmanagement-high-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "2"
  alarm_description   = "This metric monitors ALB response time"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    LoadBalancer = var.load_balancer_arn_suffix
  }
  
  tags = var.common_tags
}

resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "${var.environment}-taskmanagement-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors 5XX error rate"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    LoadBalancer = var.load_balancer_arn_suffix
  }
  
  tags = var.common_tags
}

resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${var.environment}-taskmanagement-database-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    DBInstanceIdentifier = var.database_instance_id
  }
  
  tags = var.common_tags
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.environment}-taskmanagement-alerts"
  
  tags = var.common_tags
}

resource "aws_sns_topic_subscription" "email_alerts" {
  count = length(var.alert_email_addresses)
  
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email_addresses[count.index]
}

resource "aws_sns_topic_subscription" "slack_alerts" {
  count = var.slack_webhook_url != "" ? 1 : 0
  
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "https"
  endpoint  = var.slack_webhook_url
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/taskmanagement/${var.environment}/application"
  retention_in_days = var.log_retention_days
  
  tags = var.common_tags
}

resource "aws_cloudwatch_log_group" "access" {
  name              = "/aws/taskmanagement/${var.environment}/access"
  retention_in_days = var.log_retention_days
  
  tags = var.common_tags
}

resource "aws_cloudwatch_log_group" "error" {
  name              = "/aws/taskmanagement/${var.environment}/error"
  retention_in_days = var.log_retention_days
  
  tags = var.common_tags
}

# CloudWatch Log Metric Filters
resource "aws_cloudwatch_log_metric_filter" "error_count" {
  name           = "${var.environment}-taskmanagement-error-count"
  log_group_name = aws_cloudwatch_log_group.application.name
  pattern        = "[timestamp, request_id, level=\"ERROR\", ...]"
  
  metric_transformation {
    name      = "ErrorCount"
    namespace = "TaskManagement/${var.environment}"
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "warning_count" {
  name           = "${var.environment}-taskmanagement-warning-count"
  log_group_name = aws_cloudwatch_log_group.application.name
  pattern        = "[timestamp, request_id, level=\"WARN\", ...]"
  
  metric_transformation {
    name      = "WarningCount"
    namespace = "TaskManagement/${var.environment}"
    value     = "1"
  }
}

# Custom Metric Alarms
resource "aws_cloudwatch_metric_alarm" "application_errors" {
  alarm_name          = "${var.environment}-taskmanagement-application-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ErrorCount"
  namespace           = "TaskManagement/${var.environment}"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors application error count"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
  
  tags = var.common_tags
}

# CloudWatch Insights Queries
resource "aws_cloudwatch_query_definition" "error_analysis" {
  name = "${var.environment}-taskmanagement-error-analysis"
  
  log_group_names = [
    aws_cloudwatch_log_group.application.name,
    aws_cloudwatch_log_group.error.name
  ]
  
  query_string = <<EOF
fields @timestamp, @message, level, error, stack
| filter level = "ERROR"
| sort @timestamp desc
| limit 100
EOF
}

resource "aws_cloudwatch_query_definition" "performance_analysis" {
  name = "${var.environment}-taskmanagement-performance-analysis"
  
  log_group_names = [
    aws_cloudwatch_log_group.application.name
  ]
  
  query_string = <<EOF
fields @timestamp, @message, duration, method, path
| filter ispresent(duration)
| stats avg(duration), max(duration), min(duration) by method, path
| sort avg(duration) desc
EOF
}

# X-Ray Tracing
resource "aws_xray_sampling_rule" "main" {
  rule_name      = "${var.environment}-taskmanagement-sampling"
  priority       = 9000
  version        = 1
  reservoir_size = 1
  fixed_rate     = 0.1
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"
  
  tags = var.common_tags
}

# Data source for current region
data "aws_region" "current" {}

# CloudWatch Composite Alarms
resource "aws_cloudwatch_composite_alarm" "system_health" {
  alarm_name        = "${var.environment}-taskmanagement-system-health"
  alarm_description = "Composite alarm for overall system health"
  
  alarm_rule = join(" OR ", [
    "ALARM(${aws_cloudwatch_metric_alarm.high_cpu.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.high_memory.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.high_response_time.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.high_error_rate.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.database_cpu.alarm_name})"
  ])
  
  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
  
  tags = var.common_tags
}