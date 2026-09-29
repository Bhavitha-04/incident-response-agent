import os
import re
from groq import Groq
from dotenv import load_dotenv
from hindsight import reflect_on_incidents, recall_with_scores
from signature import extract_signature

load_dotenv()

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def extract_confidence(text: str) -> str:
    """Extract confidence level from the diagnosis text."""
    match = re.search(r"[Cc]onfidence[:\s\-\*]+(\w+)", text)
    if match:
        level = match.group(1).lower()
        if level in ["high", "medium", "low"]:
            return level.capitalize()
    return "Unknown"


def analyze_incident(incident_description: str):
    # Step 1: Extract structured signature to enrich the memory query
    sig = extract_signature(incident_description)
    if sig['service'] or sig['error_type']:
        parts = []
        if sig['service']:
            parts.append(f"service: {sig['service']}")
        if sig['error_type']:
            parts.append(f"type: {sig['error_type']}")
        enriched_query = f"{incident_description} [{', '.join(parts)}]"
    else:
        enriched_query = incident_description

    # Step 2: Reflect - Hindsight synthesizes a reasoned answer across memories
    reflection = reflect_on_incidents(enriched_query)

    # Step 3: Recall with scores - ranked memories
    scored_memories = recall_with_scores(enriched_query)

    # Step 4: Build memory context
    memory_context = f"HINDSIGHT REFLECTION:\n{reflection}\n\n"

    if scored_memories:
        memory_context += "RANKED MEMORIES (by relevance):\n"
        for item in scored_memories:
            memory_context += f"- [score: {item['score']}] {item['text']}\n"
    else:
        memory_context += "No similar memories found."

    # Step 5: Build the prompt with signature context
    system_prompt = f"""You are an expert SRE incident response agent.

EXTRACTED SIGNATURE:
- Service: {sig['service'] or 'unknown'}
- Error type: {sig['error_type'] or 'unknown'}

{memory_context}

Use the reflection and ranked memories above to give a SPECIFIC diagnosis.
Identify:
1. Root cause
2. Exact fix (with commands if applicable)
3. Severity
4. Confidence (High/Medium/Low) based on memory match quality

If this matches a known pattern, say so explicitly.

CRITICAL - TRAP ACTION AWARENESS:
If past incidents mention trap actions (fixes that made things worse),
you MUST explicitly warn against them with "DO NOT do X".

FORMATTING: Plain ASCII only. Use hyphens, ->, and [1], [2]. No emojis."""

    # Step 6: Call the LLM
    response = groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": incident_description},
        ],
        max_tokens=2000,
    )

    diagnosis_text = response.choices[0].message.content
    confidence = extract_confidence(diagnosis_text)

    return {
        "diagnosis": diagnosis_text,
        "confidence": confidence,
        "signature": sig,
    }