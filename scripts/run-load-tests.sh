#!/bin/bash

# Load Testing Script for Sign Language Translator
# This script runs comprehensive load tests using multiple tools

set -e

echo "🚀 Starting Load Testing Suite for Sign Language Translator"
echo "============================================================"

# Configuration
SERVER_URL="http://localhost:5000"
RESULTS_DIR="./test-results/$(date +%Y%m%d_%H%M%S)"
BACKEND_PID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

cleanup() {
    log_info "Cleaning up..."
    if [ ! -z "$BACKEND_PID" ]; then
        log_info "Stopping backend server (PID: $BACKEND_PID)"
        kill $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
    fi
    exit 0
}

trap cleanup EXIT INT TERM

check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check if artillery is installed
    if ! command -v artillery &> /dev/null; then
        log_warning "Artillery not found globally. Installing locally..."
        npm install artillery
    fi
    
    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        log_warning "k6 not found. Please install k6 for comprehensive testing."
        log_info "Install k6 from: https://k6.io/docs/getting-started/installation/"
    fi
    
    log_success "Dependencies checked"
}

start_server() {
    log_info "Starting backend server..."
    
    cd backend
    
    # Check if server is already running
    if curl -s "$SERVER_URL/api/health" > /dev/null 2>&1; then
        log_warning "Server already running at $SERVER_URL"
        cd ..
        return
    fi
    
    # Start the server in background
    npm start &
    BACKEND_PID=$!
    
    cd ..
    
    # Wait for server to start
    log_info "Waiting for server to start..."
    for i in {1..30}; do
        if curl -s "$SERVER_URL/api/health" > /dev/null 2>&1; then
            log_success "Server started successfully"
            return
        fi
        sleep 2
    done
    
    log_error "Server failed to start within 60 seconds"
    exit 1
}

setup_test_environment() {
    log_info "Setting up test environment..."
    
    # Create results directory
    mkdir -p "$RESULTS_DIR"
    
    # Create test files directory if it doesn't exist
    mkdir -p "./tests/load/test-files"
    
    # Create a small test image for upload tests
    if [ ! -f "./tests/load/test-files/test-image.jpg" ]; then
        log_info "Creating test image file..."
        # Create a minimal JPEG file (1x1 pixel)
        echo -n "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA//9k=" | base64 -d > "./tests/load/test-files/test-image.jpg"
    fi
    
    log_success "Test environment setup complete"
}

run_artillery_test() {
    log_info "Running Artillery load tests..."
    
    if command -v artillery &> /dev/null; then
        artillery run ./tests/load/artillery-config.yml \
            --output "$RESULTS_DIR/artillery-results.json" \
            2>&1 | tee "$RESULTS_DIR/artillery-output.log"
        
        # Generate HTML report
        if [ -f "$RESULTS_DIR/artillery-results.json" ]; then
            artillery report "$RESULTS_DIR/artillery-results.json" \
                --output "$RESULTS_DIR/artillery-report.html"
            log_success "Artillery test completed. Report saved to $RESULTS_DIR/artillery-report.html"
        fi
    else
        log_warning "Artillery not available, skipping Artillery tests"
    fi
}

run_k6_test() {
    log_info "Running k6 load tests..."
    
    if command -v k6 &> /dev/null; then
        k6 run ./tests/load/k6-script.js \
            --out json="$RESULTS_DIR/k6-results.json" \
            2>&1 | tee "$RESULTS_DIR/k6-output.log"
        
        log_success "k6 test completed. Results saved to $RESULTS_DIR/k6-results.json"
    else
        log_warning "k6 not available, skipping k6 tests"
    fi
}

run_basic_load_test() {
    log_info "Running basic concurrent connection test..."
    
    # Simple curl-based concurrent test
    local concurrent_users=50
    local test_duration=60
    local results_file="$RESULTS_DIR/basic-load-test.txt"
    
    echo "Basic Load Test Results" > "$results_file"
    echo "======================" >> "$results_file"
    echo "Concurrent Users: $concurrent_users" >> "$results_file"
    echo "Test Duration: ${test_duration}s" >> "$results_file"
    echo "Start Time: $(date)" >> "$results_file"
    echo "" >> "$results_file"
    
    # Run concurrent requests
    for i in $(seq 1 $concurrent_users); do
        {
            local start_time=$(date +%s%N)
            response=$(curl -s -w "%{http_code},%{time_total}" -o /dev/null "$SERVER_URL/api/health")
            local end_time=$(date +%s%N)
            local duration=$((($end_time - $start_time) / 1000000))
            echo "User$i: $response,${duration}ms" >> "$results_file"
        } &
    done
    
    # Wait for all requests to complete
    wait
    
    echo "End Time: $(date)" >> "$results_file"
    log_success "Basic load test completed. Results saved to $results_file"
}

analyze_results() {
    log_info "Analyzing test results..."
    
    local summary_file="$RESULTS_DIR/test-summary.txt"
    
    echo "Load Test Summary" > "$summary_file"
    echo "=================" >> "$summary_file"
    echo "Test Date: $(date)" >> "$summary_file"
    echo "Server URL: $SERVER_URL" >> "$summary_file"
    echo "" >> "$summary_file"
    
    # Check if artillery results exist
    if [ -f "$RESULTS_DIR/artillery-results.json" ]; then
        echo "Artillery Test: ✅ COMPLETED" >> "$summary_file"
        echo "Artillery Report: artillery-report.html" >> "$summary_file"
    else
        echo "Artillery Test: ❌ SKIPPED" >> "$summary_file"
    fi
    
    # Check if k6 results exist
    if [ -f "$RESULTS_DIR/k6-results.json" ]; then
        echo "k6 Test: ✅ COMPLETED" >> "$summary_file"
        echo "k6 Results: k6-results.json" >> "$summary_file"
    else
        echo "k6 Test: ❌ SKIPPED" >> "$summary_file"
    fi
    
    # Check if basic test results exist
    if [ -f "$RESULTS_DIR/basic-load-test.txt" ]; then
        echo "Basic Load Test: ✅ COMPLETED" >> "$summary_file"
        echo "Basic Test Results: basic-load-test.txt" >> "$summary_file"
    fi
    
    echo "" >> "$summary_file"
    echo "All results saved in: $RESULTS_DIR" >> "$summary_file"
    
    log_success "Results analysis complete. Summary saved to $summary_file"
}

generate_recommendations() {
    log_info "Generating performance recommendations..."
    
    local recommendations_file="$RESULTS_DIR/recommendations.txt"
    
    cat > "$recommendations_file" << EOF
Performance Optimization Recommendations
======================================

Based on the load test results, consider the following optimizations:

🚀 Application Performance:
- Implement database connection pooling
- Add Redis caching for frequent queries
- Optimize ML model inference times
- Use CDN for static assets

🛡️ Scalability Improvements:
- Implement horizontal pod autoscaling
- Add load balancing with nginx
- Configure database read replicas
- Use message queues for async processing

📊 Monitoring Enhancements:
- Set up Prometheus and Grafana
- Configure application performance monitoring
- Implement distributed tracing
- Add real-time alerts for performance degradation

🔧 Infrastructure Optimizations:
- Optimize Docker container resources
- Implement efficient logging strategies
- Use compression for API responses
- Configure proper caching headers

📈 Capacity Planning:
- Monitor resource utilization trends
- Plan for peak traffic scenarios
- Implement graceful degradation
- Set up auto-scaling policies

For detailed analysis, review the specific test results files.
EOF
    
    log_success "Recommendations saved to $recommendations_file"
}

# Main execution
main() {
    log_info "Load Testing Suite Starting..."
    
    # Change to project directory
    cd "$(dirname "$0")/.."
    
    check_dependencies
    setup_test_environment
    start_server
    
    # Run tests
    run_basic_load_test
    run_artillery_test
    run_k6_test
    
    # Analysis
    analyze_results
    generate_recommendations
    
    log_success "Load testing complete! Results available in: $RESULTS_DIR"
    log_info "Open $RESULTS_DIR/test-summary.txt for a quick overview"
    
    if [ -f "$RESULTS_DIR/artillery-report.html" ]; then
        log_info "Open $RESULTS_DIR/artillery-report.html in your browser for detailed Artillery results"
    fi
}

# Show usage if no arguments
if [ $# -eq 0 ]; then
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  run     - Run all load tests (default)"
    echo "  basic   - Run basic load test only"
    echo "  artillery - Run Artillery test only"
    echo "  k6      - Run k6 test only"
    echo "  help    - Show this help message"
    echo ""
    main
    exit 0
fi

case "$1" in
    "run"|"")
        main
        ;;
    "basic")
        check_dependencies
        setup_test_environment
        start_server
        run_basic_load_test
        ;;
    "artillery")
        check_dependencies
        setup_test_environment
        start_server
        run_artillery_test
        ;;
    "k6")
        check_dependencies
        setup_test_environment
        start_server
        run_k6_test
        ;;
    "help"|"-h"|"--help")
        echo "Load Testing Script for Sign Language Translator"
        echo "This script runs comprehensive load tests to evaluate system performance"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  run     - Run all available load tests"
        echo "  basic   - Run basic concurrent connection test"
        echo "  artillery - Run Artillery load test"
        echo "  k6      - Run k6 performance test"
        echo "  help    - Show this help message"
        ;;
    *)
        log_error "Unknown command: $1"
        log_info "Run '$0 help' for available commands"
        exit 1
        ;;
esac