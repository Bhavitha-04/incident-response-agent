from agent import analyze_incident

queries = [
    "Checkout service is throwing 500 errors. Recent deployment at 06:31.",
    "Redis cache cluster latency spike above 450ms",
    "Auth service 503 errors on /login under peak load",
    "BGP route reorder causing global traffic drop",
]

for q in queries:
    print("=" * 70)
    print("QUERY:", q)
    print("=" * 70)
    result = analyze_incident(q)
    print("SIGNATURE:", result["signature"])
    print("CONFIDENCE:", result["confidence"])
    print("DIAGNOSIS (first 400 chars):")
    print(result["diagnosis"][:400])
    print()