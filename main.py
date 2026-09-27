from fastapi import FastAPI
from pydantic import BaseModel
from agent import analyze_incident

app = FastAPI(title="Incident Response Agent")

class IncidentRequest(BaseModel):
    description: str

@app.post("/analyze")
def analyze(req: IncidentRequest):
    return {"diagnosis": analyze_incident(req.description)}
