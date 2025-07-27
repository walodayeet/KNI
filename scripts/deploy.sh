#!/bin/bash

# =============================================================================
# KNI Platform - Deployment Script for Coolify
# =============================================================================
# This script helps with manual deployment and troubleshooting

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="kni-platform"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
HEALTH_CHECK_URL="http://localhost:3000/api/health"
MAX_HEALTH_CHECK_ATTEMPTS=10
HEALTH_CHECK_INTERVAL=30

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        log_warning ".env file not found. Using .env.production as template"
        if [ -f ".env.production" ]; then
            cp .env.production .env
            log_info "Copied .env.production to .env"
        else
            log_error "No environment file found. Please create .env file"
            exit 1
        fi
    fi
    
    log_success "Prerequisites check passed"
}

validate_environment() {
    log_info "Validating environment variables..."
    
    # Required environment variables
    required_vars=(
        "DATABASE_URL"
        "JWT_SECRET"
        "NEXTAUTH_SECRET"
        "NEXTAUTH_URL"
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
    )
    
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ] && ! grep -q "^${var}=" .env; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    log_success "Environment validation passed"
}

build_application() {
    log_info "Building application..."
    
    # Build Docker images
    docker-compose -f "$DOCKER_COMPOSE_FILE" build --no-cache
    
    if [ $? -eq 0 ]; then
        log_success "Application built successfully"
    else
        log_error "Application build failed"
        exit 1
    fi
}

start_services() {
    log_info "Starting services..."
    
    # Start services in detached mode
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    if [ $? -eq 0 ]; then
        log_success "Services started successfully"
    else
        log_error "Failed to start services"
        exit 1
    fi
}

run_migrations() {
    log_info "Running database migrations..."
    
    # Wait for database to be ready
    sleep 10
    
    # Run Prisma migrations
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec app npx prisma migrate deploy
    
    if [ $? -eq 0 ]; then
        log_success "Database migrations completed"
    else
        log_warning "Database migrations failed or not needed"
    fi
}

health_check() {
    log_info "Performing health check..."
    
    attempt=1
    while [ $attempt -le $MAX_HEALTH_CHECK_ATTEMPTS ]; do
        log_info "Health check attempt $attempt/$MAX_HEALTH_CHECK_ATTEMPTS"
        
        if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            log_success "Health check passed!"
            curl -s "$HEALTH_CHECK_URL" | jq . 2>/dev/null || curl -s "$HEALTH_CHECK_URL"
            return 0
        else
            log_warning "Health check failed, retrying in $HEALTH_CHECK_INTERVAL seconds..."
            sleep $HEALTH_CHECK_INTERVAL
            attempt=$((attempt + 1))
        fi
    done
    
    log_error "Health check failed after $MAX_HEALTH_CHECK_ATTEMPTS attempts"
    return 1
}

show_status() {
    log_info "Application status:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
    
    echo ""
    log_info "Application logs (last 20 lines):"
    docker-compose -f "$DOCKER_COMPOSE_FILE" logs --tail=20 app
}

stop_services() {
    log_info "Stopping services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    log_success "Services stopped"
}

cleanup() {
    log_info "Cleaning up..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" down -v --remove-orphans
    docker system prune -f
    log_success "Cleanup completed"
}

backup_database() {
    log_info "Creating database backup..."
    
    backup_dir="./backups"
    mkdir -p "$backup_dir"
    
    backup_file="$backup_dir/backup_$(date +%Y%m%d_%H%M%S).sql"
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec postgres pg_dump -U kni_user kni_db > "$backup_file"
    
    if [ $? -eq 0 ]; then
        log_success "Database backup created: $backup_file"
    else
        log_error "Database backup failed"
        exit 1
    fi
}

restore_database() {
    if [ -z "$1" ]; then
        log_error "Please provide backup file path"
        exit 1
    fi
    
    backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_info "Restoring database from: $backup_file"
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U kni_user -d kni_db < "$backup_file"
    
    if [ $? -eq 0 ]; then
        log_success "Database restored successfully"
    else
        log_error "Database restore failed"
        exit 1
    fi
}

show_help() {
    echo "KNI Platform Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy          Full deployment (build, start, migrate, health check)"
    echo "  build           Build application images"
    echo "  start           Start services"
    echo "  stop            Stop services"
    echo "  restart         Restart services"
    echo "  status          Show application status"
    echo "  logs            Show application logs"
    echo "  health          Perform health check"
    echo "  migrate         Run database migrations"
    echo "  backup          Create database backup"
    echo "  restore [file]  Restore database from backup"
    echo "  cleanup         Stop services and clean up"
    echo "  help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy                    # Full deployment"
    echo "  $0 backup                    # Create database backup"
    echo "  $0 restore backup.sql        # Restore from backup"
    echo "  $0 logs                      # View application logs"
}

# Main script logic
case "${1:-deploy}" in
    "deploy")
        log_info "Starting full deployment..."
        check_prerequisites
        validate_environment
        build_application
        start_services
        run_migrations
        if health_check; then
            log_success "Deployment completed successfully! 🚀"
            show_status
        else
            log_error "Deployment failed during health check"
            show_status
            exit 1
        fi
        ;;
    "build")
        check_prerequisites
        build_application
        ;;
    "start")
        check_prerequisites
        start_services
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        stop_services
        start_services
        ;;
    "status")
        show_status
        ;;
    "logs")
        docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f app
        ;;
    "health")
        health_check
        ;;
    "migrate")
        run_migrations
        ;;
    "backup")
        backup_database
        ;;
    "restore")
        restore_database "$2"
        ;;
    "cleanup")
        cleanup
        ;;
    "help")
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac