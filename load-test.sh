#!/bin/bash

# Load Test Script for OTT Platform
# Tests concurrent HLS streaming and API requests

API_GATEWAY="http://localhost:3000"
VIDEO_ID="efbe8bb1-5377-46be-b56c-5a87a864d1b6"

echo "======================================"
echo "OTT Platform Load Test"
echo "======================================"
echo ""

# Function to run load test
run_load_test() {
    local concurrent=$1
    local requests=$2
    local test_name=$3
    
    echo "🔄 Test: $test_name"
    echo "   Concurrency: $concurrent | Total Requests: $requests"
    echo ""
    
    # Start monitoring resources in background
    (
        while true; do
            docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | grep -E "api-gateway|content-service|streaming" | head -3
            sleep 2
        done
    ) &
    MONITOR_PID=$!
    
    # Run the load test
    ab -n $requests -c $concurrent "$API_GATEWAY/api/content/videos/$VIDEO_ID/hls" 2>&1 | grep -E "Requests/sec|Time per request|Failed requests|Concurrency Level|Document Length"
    
    # Stop monitoring
    kill $MONITOR_PID 2>/dev/null
    wait $MONITOR_PID 2>/dev/null
    
    echo ""
    echo "Resource Usage After Test:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | grep -E "api-gateway|content-service|streaming|postgres|mongodb"
    echo ""
    echo "---"
    echo ""
}

# Get video ID from API
echo "📹 Fetching video list..."
VIDEO_RESPONSE=$(curl -s "$API_GATEWAY/api/content/videos" 2>/dev/null)
VIDEO_ID=$(echo "$VIDEO_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$VIDEO_ID" ]; then
    echo "❌ No videos found! Please upload a video first."
    exit 1
fi

echo "✅ Found video: $VIDEO_ID"
echo ""

# Pre-warm
echo "🔥 Pre-warming caches..."
curl -s "$API_GATEWAY/api/content/videos/$VIDEO_ID/hls" > /dev/null
sleep 1
echo "✅ Ready!"
echo ""

# Run tests with increasing load
echo "Starting load tests..."
echo ""

# Low load test
run_load_test 2 10 "Low Load (2 concurrent, 10 total)"

# Medium load test  
run_load_test 4 20 "Medium Load (4 concurrent, 20 total)"

# High load test
run_load_test 8 40 "High Load (8 concurrent, 40 total)"

# Very High load test
run_load_test 16 80 "Very High Load (16 concurrent, 80 total)"

# Peak load test
run_load_test 32 160 "Peak Load (32 concurrent, 160 total)"

echo ""
echo "======================================"
echo "✅ Load Test Complete!"
echo "======================================"
echo ""
echo "Final System Status:"
docker stats --no-stream 2>/dev/null | head -1
docker stats --no-stream 2>/dev/null | grep -E "api-gateway|content-service|streaming-service|postgres|mongodb|elasticsearch|kafka"
