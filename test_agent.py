from agent import analyze_incident

query = "API latency spike on /checkout, error rate 12%"
print("QUERY:", query)
print("=" * 60)
print(analyze_incident(query))