import sys
import io

# Force UTF-8 output for Windows terminal
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)

from agent import analyze_incident

query = "API latency spike on /checkout, error rate 12%"
print("QUERY:", query)
print("=" * 60)
print(analyze_incident(query))