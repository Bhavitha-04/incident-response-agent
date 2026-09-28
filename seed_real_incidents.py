from datasets import load_dataset
from hindsight import store_incident

# Load the "real" split (114 verified real-world cascading outages)
ds = load_dataset("quantranger/opensre-incident-trajectories", "real", split="train")

print(f"Loaded {len(ds)} real incidents.")

for i, record in enumerate(ds):
    # Build a clean, structured text block for Hindsight to extract from
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
    print(f"[{i+1}/{len(ds)}] Stored: {record.get('source_company')} - {record.get('incident')}")

print(f"\nDone. {len(ds)} real incidents stored in Hindsight.")