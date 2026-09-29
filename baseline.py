import os
from groq import Groq
from dotenv import load_dotenv
from agent import analyze_incident

load_dotenv()
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def analyze_without_memory(incident_description: str):
    """Same LLM, no Hindsight memory. This is the baseline."""
    system_prompt = """You are an expert SRE incident response agent.

Diagnose the incident. Identify:
1. Root cause
2. Exact fix (with commands if applicable)
3. Severity

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


if __name__ == "__main__":
    query = "Checkout service is throwing 500 errors. Recent deployment at 06:31. Error rate 12%. Should we roll back?"

    print("=" * 70)
    print("BASELINE: Same LLM, NO memory")
    print("=" * 70)
    print(analyze_without_memory(query))

    print("\n" + "=" * 70)
    print("WITH HINDSIGHT MEMORY")
    print("=" * 70)
    print(analyze_incident(query)["diagnosis"])