import os
from groq import Groq
from dotenv import load_dotenv
from hindsight import recall_incidents, reflect_on_incidents, recall_with_scores

load_dotenv()
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def analyze_incident(incident_description: str):
    reflection = reflect_on_incidents(incident_description)
    scored_memories = recall_with_scores(incident_description)

    # Build memory context with scores
    memory_context = f"HINDSIGHT REFLECTION:\n{reflection}\n\n"
    if scored_memories:
        memory_context += "RANKED MEMORIES (by relevance):\n"
        for item in scored_memories:
            memory_context += f"- [score: {item['score']}] {item['text']}\n"
    else:
        memory_context += "No similar memories found."

    system_prompt = f"""You are an expert SRE incident response agent.

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

    response = groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": incident_description},
        ],
        max_tokens=2000,
    )
    return response.choices[0].message.content