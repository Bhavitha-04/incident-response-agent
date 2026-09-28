from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from agent import analyze_incident

app = FastAPI(title="Incident Response Agent")

class IncidentRequest(BaseModel):
    description: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/analyze")
def analyze(req: IncidentRequest):
    return {"diagnosis": analyze_incident(req.description)}

app.mount("/", StaticFiles(directory="static", html=True), name="static")