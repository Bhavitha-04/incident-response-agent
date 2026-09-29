import time
from agent import analyze_incident

test_incidents = [
    "API latency spike on /checkout, error rate 12%",
    "Checkout service throwing 500 errors after deployment at 06:31",
    "Redis cache cluster latency spike above 450ms",
    "BGP route reorder causing global traffic drop",
    "DNS zone corruption affecting multiple services",
    "Kubernetes pods in CrashLoopBackOff after upgrade",
    "Database connection pool exhausted, 500/500 connections",
    "Systemd network restart flushing CNI routes",
    "HPA aggressively scaling due to low CPU during network fault",
    "WAF manual edit causing configuration drift",
]

for i, incident in enumerate(test_incidents, 1):
    print(f"\n{'='*70}")
    print(f"TEST {i}: {incident}")
    print('='*70)
    try:
        result = analyze_incident(incident)
        print(result[:800])
    except Exception as e:
        print(f"ERROR: {e}")
    
    # Wait 20 seconds between tests to avoid rate limits
    if i < len(test_incidents):
        print(f"\nWaiting 20s before next test...")
        time.sleep(20)