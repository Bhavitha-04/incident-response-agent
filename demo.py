from agent import analyze_incident
from hindsight import client, BANK_ID
import hindsight

query = "API latency spike on /checkout, error rate 12%"

print("\n" + "=" * 70)
print("BEFORE: Agent with NO memory")
print("=" * 70)

# Create a fresh empty bank
client.create_bank(bank_id="empty-bank")
original_bank = hindsight.BANK_ID
hindsight.BANK_ID = "empty-bank"

before = analyze_incident(query)
print(before)

print("\n" + "=" * 70)
print("AFTER: Agent with Hindsight memory")
print("=" * 70)

hindsight.BANK_ID = original_bank
after = analyze_incident(query)
print(after)