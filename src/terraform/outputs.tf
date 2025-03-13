output "ecs_service_url" {
  value = "http://${aws_lb.nba_prediction_alb.dns_name}:8000"
}