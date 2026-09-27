from hindsight import store_incident, recall_incidents

store_incident("Test incident: Redis timeout caused API latency. Fixed by increasing pool size.")
print("Stored successfully.")

results = recall_incidents("Redis timeout")
print("Recalled:", results)