import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 25 },  // Ramp-up to 25 concurrent users
    { duration: '30s', target: 100 }, // Peak stress at 100 concurrent streams
    { duration: '10s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<350'], // 95% of requests must complete below 350ms
    http_req_failed: ['rate<0.01'],   // Less than 1% failure rate
  },
};

export default function () {
  // 1. Stress HLS Video Segment Edge Delivery
  const segRes = http.get('http://ott-nginx/api/stream/543a5a48-0bf5-405e-b0b1-e65690cc4a24/segment/playlist0?quality=1080p');
  check(segRes, {
    'Segment status is 200': (r) => r.status === 200,
    'Cache is HIT': (r) => r.headers['X-Cache-Status'] === 'HIT',
  });

  // 2. Stress Elasticsearch Catalog Search
  const searchRes = http.get('http://ott-nginx/api/content/search?q=cinema');
  check(searchRes, {
    'Search status is 200': (r) => r.status === 200,
  });

  sleep(0.05);
}
