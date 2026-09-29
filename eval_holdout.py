import json
import time
from agent import analyze_incident
from baseline import analyze_without_memory

# Load the 10 held-out incidents
with open("holdout_incidents.json", "r", encoding="utf-8") as f:
    holdout = json.load(f)

print(f"Loaded {len(holdout)} held-out incidents.\n")

results = []

for i, incident in enumerate(holdout):
    # Use only the symptom, never the root cause or postmortem wording
    symptom = incident.get("incident", "").replace("_", " ")
    company = incident.get("source_company", "Unknown")
    true_category = incident.get("true_category", "Unknown")

    query = f"Production incident reported: {symptom}. Source company: {company}. Diagnose the root cause and give the fix."

    print(f"\n{'='*70}")
    print(f"HOLD-OUT {i+1}/{len(holdout)}: {symptom} ({company})")
    print(f"True category: {true_category}")
    print('='*70)

    # WITH memory
    try:
        mem_result = analyze_incident(query)
        mem_diagnosis = mem_result["diagnosis"]
        mem_conf = mem_result["confidence"]
    except Exception as e:
        mem_diagnosis = f"ERROR: {e}"
        mem_conf = "Error"

    time.sleep(20)  # Rate limit buffer

    # WITHOUT memory (baseline)
    try:
        base_diagnosis = analyze_without_memory(query)
    except Exception as e:
        base_diagnosis = f"ERROR: {e}"

    time.sleep(20)

    results.append({
        "id": incident.get("incident"),
        "company": company,
        "true_category": true_category,
        "with_memory": mem_diagnosis,
        "with_memory_confidence": mem_conf,
        "without_memory": base_diagnosis,
    })

    print(f"\nWITH MEMORY (confidence: {mem_conf}):")
    print(mem_diagnosis[:600])
    print(f"\nWITHOUT MEMORY:")
    print(base_diagnosis[:600])

# Save results
with open("eval_holdout_results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, default=str)

print(f"\n\nDone. Results saved to eval_holdout_results.json")