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