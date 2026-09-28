import os
from groq import Groq
from dotenv import load_dotenv
from hindsight import recall_incidents, reflect_on_incidents

load_dotenv()

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def analyze_incident(incident_description: str):
    # Step 1: Reflect - Hindsight synthesizes a reasoned answer across memories
    reflection = reflect_on_incidents(incident_description)

    # Step 2: Recall - fetch raw matches for specific incident references
    memories = recall_incidents(incident_description)

    # Step 3: Build memory context combining both
    memory_context = f"HINDSIGHT REFLECTION (synthesized from past incidents):\n{reflection}\n\n"

    if memories and memories.results:
        memory_lines = [f"- {m.text}" for m in memories.results]
        memory_context += "RAW MATCHES (specific incidents):\n" + "\n".join(memory_lines)
    else:
        memory_context += "No raw matches found."

    # Step 4: Build the prompt
    system_prompt = f"""You are an expert SRE incident response agent.

{memory_context}

Use the reflection and past incidents above to give a SPECIFIC diagnosis.
Identify:
1. Root cause
2. Exact fix (with commands if applicable)
3. Severity

If this matches a known pattern from past incidents, say so explicitly.

CRITICAL - TRAP ACTION AWARENESS:
If the recalled memories or reflection mention trap actions (fixes that made things worse),
you MUST explicitly warn against them. Say: "DO NOT do X - this was a trap action in past incidents."
Explain what happened when that fix was attempted, and recommend diagnostics or alternatives.

IMPORTANT FORMATTING RULES:
- Use plain ASCII only. No Unicode symbols, arrows, emojis, or special characters.
- Use regular hyphens (-).
- Use -> instead of the arrow character.
- Use * or - for bullet points, not the bullet symbol.
- Use [1], [2] instead of keycap emojis.
- No checkmarks, crosses, warning signs, or any emoji.
- Output should be readable in a plain terminal.
"""

    # Step 5: Call the LLM
    response = groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": incident_description},
        ],
    )
    return response.choices[0].message.content