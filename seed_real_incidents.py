import json
from datasets import load_dataset
from hindsight import store_incident

# Load the "real" split (114 verified real-world cascading outages)
ds = load_dataset("quantranger/opensre-incident-trajectories", "real", split="train")

print(f"Loaded {len(ds)} real incidents.")

# Withhold 10 incidents for the hold-out test
HOLD_OUT_COUNT = 10
all_records = list(ds)
hold_out = all_records[:HOLD_OUT_COUNT]
to_seed = all_records[HOLD_OUT_COUNT:]

print(f"Withholding {len(hold_out)} incidents for evaluation.")
print(f"Seeding {len(to_seed)} incidents into the new bank.")

# Save held-out incidents to a file for the evaluation script
with open("holdout_incidents.json", "w", encoding="utf-8") as f:
    json.dump([dict(item) for item in hold_out], f, indent=2, default=str)
print("Saved holdout_incidents.json")

# Seed only the non-held-out incidents
for i, record in enumerate(to_seed):
    trap_actions = record.get("trap_actions", [])
    trap_text = "\n".join([f"  - TRAP: {t}" for t in trap_actions]) if trap_actions else "  - None"

    incident_text = f"""
Incident: {record.get('incident', f'REAL-{i}')}
Source Company: {record.get('source_company', 'Unknown')}
Source URL: {record.get('source_url', 'Unknown')}
Difficulty: {record.get('difficulty', 'Unknown')}/5
Root Cause Category: {record.get('true_category', 'Unknown')}
Full Analysis: {record.get('answer', 'No analysis provided')[:2000]}
Known Trap Actions (DO NOT DO THESE):
{trap_text}
"""

    store_incident(incident_text)
    print(f"[{i+1}/{len(to_seed)}] Stored: {record.get('source_company')} - {record.get('incident')}")

print(f"\nDone. {len(to_seed)} incidents seeded. {len(hold_out)} held out for evaluation.")