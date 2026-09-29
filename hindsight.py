import warnings
warnings.filterwarnings("ignore", message="Unclosed")

import os
from hindsight_client import Hindsight
from dotenv import load_dotenv

load_dotenv()

client = Hindsight(
    base_url=os.getenv("HINDSIGHT_API_URL"),
    api_key=os.getenv("HINDSIGHT_API_KEY"),
)

BANK_ID = os.getenv("BANK_ID", "incident-response")

def store_incident(content: str):
    client.retain(bank_id=BANK_ID, content=content)

def recall_incidents(query: str):
    return client.recall(bank_id=BANK_ID, query=query)

def reflect_on_incidents(query: str):
    return client.reflect(bank_id=BANK_ID, query=query)

def recall_with_scores(query: str):
    """Recall memories and rank them by relevance."""
    results = recall_incidents(query)
    scored = []
    if results and results.results:
        query_terms = set(query.lower().split())
        for m in results.results:
            score = 0.5  # base relevance
            text_lower = m.text.lower()
            # Term overlap boosts score
            matches = sum(1 for term in query_terms if term in text_lower)
            score += min(matches * 0.1, 0.3)
            # Trap actions get a boost (they're valuable)
            if "trap" in text_lower:
                score += 0.2
            scored.append({"text": m.text, "score": round(min(score, 1.0), 2)})
    return sorted(scored, key=lambda x: x["score"], reverse=True)