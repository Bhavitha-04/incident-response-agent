from hindsight import store_incident

incidents = [
    "Service: payments-api | Alert: Latency spike >2000ms on /checkout | Root cause: Redis connection pool exhausted | Resolution: Increased pool size from 10 to 50, restarted service",
    "Service: payments-api | Alert: CrashLoopBackOff on payments-gateway | Root cause: Missing PAYMENT_API_KEY in ConfigMap | Resolution: Added key to ConfigMap, restarted deployment",
    "Service: auth-service | Alert: 503 errors on /login | Root cause: Redis maxclients set too low under peak load | Resolution: Increased maxclients to 500 via redis-cli CONFIG SET",
    "Service: payments-api | Alert: Latency spike on /checkout | Root cause: Redis connection pool exhaustion (recurrence) | Resolution: Increased pool size from 50 to 100",
    "Service: inventory-service | Alert: Database timeout during bulk updates | Root cause: Missing index on inventory.sku column | Resolution: Created index, queries dropped from 4s to 200ms",
]

for inc in incidents:
    store_incident(inc)
    print(f"Stored: {inc[:60]}...")