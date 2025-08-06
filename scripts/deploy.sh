#!/bin/bash

# Sign Language Translator - Production Deployment Script
# This script handles the complete deployment process for production

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env.production"
DOCKER_COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if running as root or with sudo
    if [[ $EUID -eq 0 ]]; then
        log_warning "Running as root. Consider running as a regular user with Docker permissions."
    fi
    
    log_success "Prerequisites check passed"
}

# Function to setup environment
setup_environment() {
    log_info "Setting up production environment..."
    
    cd "$PROJECT_DIR"
    
    # Check if .env.production exists
    if [[ ! -f "$ENV_FILE" ]]; then
        log_warning ".env.production not found. Creating from template..."
        
        cat > "$ENV_FILE" << 'EOF'
# Production Environment Configuration
NODE_ENV=production

# Database Configuration
MONGODB_USERNAME=admin
MONGODB_PASSWORD=change_this_secure_password_123
MONGODB_DATABASE=signlang_prod

# Redis Configuration
REDIS_PASSWORD=change_this_redis_password_456

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=change_this_jwt_secret_789
JWT_REFRESH_SECRET=change_this_refresh_secret_012

# API URLs
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_SOCKET_URL=wss://yourdomain.com

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# External Services (optional)
AZURE_SPEECH_KEY=your-azure-speech-key
AZURE_SPEECH_REGION=eastus
SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_SENTRY_DSN=your-public-sentry-dsn

# Monitoring (optional)
GRAFANA_PASSWORD=secure_grafana_password
EOF
        
        log_warning "Please edit $ENV_FILE with your actual configuration values"
        log_warning "IMPORTANT: Change all default passwords and secrets!"
        
        # Open file for editing if editor is available
        if command -v nano &> /dev/null; then
            read -p "Do you want to edit the environment file now? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                nano "$ENV_FILE"
            fi
        fi
    fi
    
    log_success "Environment setup completed"
}

# Function to setup SSL certificates
setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    SSL_DIR="${PROJECT_DIR}/ssl"
    mkdir -p "$SSL_DIR"
    
    if [[ ! -f "${SSL_DIR}/server.crt" ]] || [[ ! -f "${SSL_DIR}/server.key" ]]; then
        log_warning "SSL certificates not found. Options:"
        echo "1. Use Let's Encrypt (recommended for production)"
        echo "2. Use existing certificates"
        echo "3. Generate self-signed certificates (development only)"
        
        read -p "Choose option (1/2/3): " -n 1 -r
        echo
        
        case $REPLY in
            1)
                setup_letsencrypt
                ;;
            2)
                log_info "Please copy your SSL certificates to:"
                log_info "- Certificate: ${SSL_DIR}/server.crt"
                log_info "- Private Key: ${SSL_DIR}/server.key"
                log_info "- CA Bundle (optional): ${SSL_DIR}/ca.crt"
                read -p "Press Enter after copying the certificates..."
                ;;
            3)
                generate_self_signed_certs
                ;;
            *)
                log_error "Invalid option selected"
                exit 1
                ;;
        esac
    fi
    
    # Verify certificates exist
    if [[ ! -f "${SSL_DIR}/server.crt" ]] || [[ ! -f "${SSL_DIR}/server.key" ]]; then
        log_error "SSL certificates are missing. Deployment cannot continue."
        exit 1
    fi
    
    log_success "SSL certificates configured"
}

# Function to setup Let's Encrypt certificates
setup_letsencrypt() {
    log_info "Setting up Let's Encrypt certificates..."
    
    read -p "Enter your domain name: " DOMAIN
    read -p "Enter your email address: " EMAIL
    
    if [[ -z "$DOMAIN" ]] || [[ -z "$EMAIL" ]]; then
        log_error "Domain and email are required for Let's Encrypt"
        exit 1
    fi
    
    # Install certbot if not present
    if ! command -v certbot &> /dev/null; then
        log_info "Installing certbot..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y certbot
        elif command -v yum &> /dev/null; then
            sudo yum install -y certbot
        else
            log_error "Please install certbot manually"
            exit 1
        fi
    fi
    
    # Generate certificates
    log_info "Generating Let's Encrypt certificates..."
    sudo certbot certonly --standalone -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive
    
    # Copy certificates to project directory
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "${SSL_DIR}/server.crt"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "${SSL_DIR}/server.key"
    sudo chown $(whoami):$(whoami) "${SSL_DIR}/server.crt" "${SSL_DIR}/server.key"
    
    log_success "Let's Encrypt certificates generated"
}

# Function to generate self-signed certificates
generate_self_signed_certs() {
    log_warning "Generating self-signed certificates (NOT suitable for production)"
    
    SSL_DIR="${PROJECT_DIR}/ssl"
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "${SSL_DIR}/server.key" \
        -out "${SSL_DIR}/server.crt" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    
    log_success "Self-signed certificates generated"
}

# Function to build Docker images
build_images() {
    log_info "Building Docker images..."
    
    cd "$PROJECT_DIR"
    
    # Build production images
    docker-compose -f "$DOCKER_COMPOSE_FILE" build --no-cache
    
    log_success "Docker images built successfully"
}

# Function to run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Start only MongoDB for migrations
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d mongodb redis
    
    # Wait for MongoDB to be ready
    log_info "Waiting for MongoDB to be ready..."
    sleep 10
    
    # Run migrations (if any)
    # docker-compose -f "$DOCKER_COMPOSE_FILE" exec backend npm run migrate
    
    log_success "Database migrations completed"
}

# Function to start services
start_services() {
    log_info "Starting production services..."
    
    cd "$PROJECT_DIR"
    
    # Start core services
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d mongodb redis backend frontend nginx
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    check_service_health
    
    log_success "Production services started successfully"
}

# Function to start monitoring services
start_monitoring() {
    log_info "Starting monitoring services..."
    
    cd "$PROJECT_DIR"
    
    # Start monitoring stack
    docker-compose -f "$DOCKER_COMPOSE_FILE" --profile monitoring up -d
    
    log_success "Monitoring services started"
}

# Function to check service health
check_service_health() {
    log_info "Checking service health..."
    
    local services=("signlang-mongodb" "signlang-redis" "signlang-backend" "signlang-frontend" "signlang-nginx")
    local unhealthy_services=()
    
    for service in "${services[@]}"; do
        if docker ps --filter "name=$service" --filter "health=healthy" | grep -q "$service"; then
            log_success "$service is healthy"
        else
            log_error "$service is not healthy"
            unhealthy_services+=("$service")
        fi
    done
    
    if [[ ${#unhealthy_services[@]} -gt 0 ]]; then
        log_error "Some services are not healthy. Check logs with:"
        for service in "${unhealthy_services[@]}"; do
            log_error "docker logs $service"
        done
        return 1
    fi
    
    return 0
}

# Function to display post-deployment information
show_deployment_info() {
    log_success "🎉 Deployment completed successfully!"
    echo
    log_info "Your Sign Language Translator application is now running:"
    echo
    echo "🌐 Application: https://localhost (or your domain)"
    echo "📊 Health Check: https://localhost/health"
    echo "📈 Metrics: https://localhost/metrics (internal access only)"
    echo
    log_info "Optional monitoring services:"
    echo "📊 Grafana: http://localhost:3001"
    echo "🔍 Kibana: http://localhost:5601"
    echo "⚡ Prometheus: http://localhost:9090"
    echo
    log_info "Useful commands:"
    echo "• View logs: docker-compose -f docker-compose.prod.yml logs -f [service_name]"
    echo "• Stop services: docker-compose -f docker-compose.prod.yml down"
    echo "• Restart services: docker-compose -f docker-compose.prod.yml restart [service_name]"
    echo "• Update application: git pull && $0 --update"
    echo
    log_warning "Important security reminders:"
    echo "• Change default passwords in .env.production"
    echo "• Configure firewall rules"
    echo "• Set up SSL certificate renewal (if using Let's Encrypt)"
    echo "• Regular security updates and monitoring"
}

# Function to handle updates
update_deployment() {
    log_info "Updating deployment..."
    
    cd "$PROJECT_DIR"
    
    # Pull latest changes
    git pull
    
    # Rebuild images
    build_images
    
    # Restart services
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    log_success "Deployment updated successfully"
}

# Function to cleanup resources
cleanup() {
    log_info "Cleaning up resources..."
    
    cd "$PROJECT_DIR"
    
    # Remove unused Docker images
    docker image prune -f
    
    # Remove unused volumes (be careful!)
    # docker volume prune -f
    
    log_success "Cleanup completed"
}

# Function to backup data
backup_data() {
    log_info "Creating data backup..."
    
    BACKUP_DIR="${PROJECT_DIR}/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup MongoDB
    docker exec signlang-mongodb mongodump --out /tmp/backup
    docker cp signlang-mongodb:/tmp/backup "$BACKUP_DIR/mongodb"
    
    # Backup uploaded files
    docker cp signlang-backend:/app/backend/uploads "$BACKUP_DIR/uploads"
    
    # Backup logs
    docker cp signlang-backend:/app/backend/logs "$BACKUP_DIR/logs"
    
    # Create archive
    tar -czf "${BACKUP_DIR}.tar.gz" -C "$BACKUP_DIR" .
    rm -rf "$BACKUP_DIR"
    
    log_success "Backup created: ${BACKUP_DIR}.tar.gz"
}

# Main deployment function
main_deploy() {
    log_info "🚀 Starting Sign Language Translator deployment..."
    echo
    
    check_prerequisites
    setup_environment
    setup_ssl
    build_images
    run_migrations
    start_services
    
    # Ask if user wants monitoring
    read -p "Do you want to start monitoring services? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        start_monitoring
    fi
    
    show_deployment_info
}

# Script entry point
case "${1:-deploy}" in
    "deploy")
        main_deploy
        ;;
    "--update")
        update_deployment
        ;;
    "--backup")
        backup_data
        ;;
    "--cleanup")
        cleanup
        ;;
    "--health")
        check_service_health
        ;;
    "--help")
        echo "Sign Language Translator Deployment Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy    - Full deployment (default)"
        echo "  --update  - Update existing deployment"
        echo "  --backup  - Create data backup"
        echo "  --cleanup - Clean up unused Docker resources"
        echo "  --health  - Check service health"
        echo "  --help    - Show this help message"
        ;;
    *)
        log_error "Unknown command: $1"
        log_info "Run '$0 --help' for available commands"
        exit 1
        ;;
esac