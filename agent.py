import os
from groq import Groq
from dotenv import load_dotenv
from hindsight import recall_incidents

load_dotenv()

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def analyze_incident(incident_description: str):
    # Step 1: Recall similar past incidents from Hindsight
    memories = recall_incidents(incident_description)

    # Step 2: Format memories as context
    if memories and memories.results:
        memory_lines = [f"- {m.text}" for m in memories.results]
        memory_context = "Similar past incidents:\n" + "\n".join(memory_lines)
    else:
        memory_context = "No similar past incidents found."

    # Step 3: Build the prompt with memory context
    system_prompt = f"""You are an expert SRE incident response agent.

{memory_context}

Use the past incidents above to give a SPECIFIC diagnosis.
Identify:
1. Root cause
2. Exact fix (with commands if applicable)
3. Severity

If this matches a known pattern from past incidents, say so explicitly."""

    # Step 4: Call the LLM
    response = groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": incident_description},
        ],
    )
    return response.choices[0].message.content