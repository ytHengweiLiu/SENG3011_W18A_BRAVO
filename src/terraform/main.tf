# Provider Configuration
provider "aws" {
  region = "us-east-1"
}

# S3 Bucket
resource "aws_s3_bucket" "nba_prediction_bucket" {
  bucket = "nba-prediction-bucket-seng3011"  # Replace with a unique name
}

# Disable ACLs and enforce bucket owner enforced
resource "aws_s3_bucket_ownership_controls" "nba_prediction_bucket_ownership" {
  bucket = aws_s3_bucket.nba_prediction_bucket.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Set the bucket policy to private
resource "aws_s3_bucket_public_access_block" "nba_prediction_bucket_public_access" {
  bucket = aws_s3_bucket.nba_prediction_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "ecsTaskExecutionRole"

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
}

resource "aws_iam_policy" "s3_access_policy" {
  name        = "S3AccessPolicy"
  description = "Allow ECS task to access S3 bucket"
  policy      = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Resource = "arn:aws:s3:::nba-prediction-bucket-seng3011/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_s3_access" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = aws_iam_policy.s3_access_policy.arn
}

# Attach the AmazonECSTaskExecutionRolePolicy to the IAM Role
resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS Cluster
resource "aws_ecs_cluster" "nba_prediction_cluster" {
  name = "nba-prediction-cluster"
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "nba_prediction_log_group" {
  name = "/ecs/nba-prediction-task"
}

# ECS Task Definition
resource "aws_ecs_task_definition" "nba_prediction_task" {
  family                   = "nba-prediction-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = "nba-prediction-app"
      image     = "851725446831.dkr.ecr.us-east-1.amazonaws.com/nba-prediction-app:latest"
      essential = true
      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
        }
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
      environment = [
        {
          name  = "AWS_ACCESS_KEY_ID"
          value = var.aws_access_key_id
        },
        {
          name  = "AWS_SECRET_ACCESS_KEY"
          value = var.aws_secret_access_key
        },
        {
          name  = "S3_BUCKET_NAME"
          value = aws_s3_bucket.nba_prediction_bucket.bucket
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.nba_prediction_log_group.name
          awslogs-region        = "us-east-1"
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
}

# VPC
resource "aws_vpc" "nba_prediction_vpc" {
  cidr_block = "10.0.0.0/16"
}

# Public Subnet 1
resource "aws_subnet" "public_subnet_1" {
  vpc_id            = aws_vpc.nba_prediction_vpc.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = "us-east-1a"
}

# Public Subnet 2
resource "aws_subnet" "public_subnet_2" {
  vpc_id            = aws_vpc.nba_prediction_vpc.id
  cidr_block        = "10.0.20.0/24"
  availability_zone = "us-east-1b"
}

# Internet Gateway
resource "aws_internet_gateway" "nba_prediction_igw" {
  vpc_id = aws_vpc.nba_prediction_vpc.id
}

# Route Table
resource "aws_route_table" "nba_prediction_rt" {
  vpc_id = aws_vpc.nba_prediction_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.nba_prediction_igw.id
  }
}

# Associate Route Table with Public Subnets
resource "aws_route_table_association" "nba_prediction_rta_1" {
  subnet_id      = aws_subnet.public_subnet_1.id
  route_table_id = aws_route_table.nba_prediction_rt.id
}

resource "aws_route_table_association" "nba_prediction_rta_2" {
  subnet_id      = aws_subnet.public_subnet_2.id
  route_table_id = aws_route_table.nba_prediction_rt.id
}

# Security Group for ALB
resource "aws_security_group" "alb_sg" {
  name        = "nba-prediction-alb-sg"
  description = "Security group for NBA Prediction ALB"
  vpc_id      = aws_vpc.nba_prediction_vpc.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Allow HTTP traffic from anywhere
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]  # Allow all outbound traffic
  }
}

# Security Group for ECS
resource "aws_security_group" "ecs_sg" {
  vpc_id = aws_vpc.nba_prediction_vpc.id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]  # Allow traffic from the ALB
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Application Load Balancer (ALB)
resource "aws_lb" "nba_prediction_alb" {
  name               = "nba-prediction-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = [aws_subnet.public_subnet_1.id, aws_subnet.public_subnet_2.id]
}

# Target Group for ALB
resource "aws_lb_target_group" "nba_prediction_tg" {
  name     = "nba-prediction-tg"
  port     = 8000
  protocol = "HTTP"
  vpc_id   = aws_vpc.nba_prediction_vpc.id
  target_type = "ip"

  health_check {
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }
}

# ALB Listener
resource "aws_lb_listener" "nba_prediction_listener" {
  load_balancer_arn = aws_lb.nba_prediction_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.nba_prediction_tg.arn
  }
}

# ECS Service
resource "aws_ecs_service" "nba_prediction_service" {
  name            = "nba-prediction-service"
  cluster         = aws_ecs_cluster.nba_prediction_cluster.id
  task_definition = aws_ecs_task_definition.nba_prediction_task.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = [aws_subnet.public_subnet_1.id, aws_subnet.public_subnet_2.id]
    security_groups = [aws_security_group.ecs_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.nba_prediction_tg.arn
    container_name   = "nba-prediction-app"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.nba_prediction_listener]
}