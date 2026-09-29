# Incident Response Agent

An AI agent that learns from real production outages using Hindsight memory.

## What It Does

- Recalls past incidents from 114 real postmortems (Slack, Cloudflare, GitHub, AWS, Datadog, CircleCI)
- Warns against "trap actions" that made past outages worse
- Gives specific fixes based on what worked before
- Uses Hindsight's full memory API (`retain`, `recall`, `reflect`)

## Architecture
User (Browser UI)
|
v
FastAPI Backend (/analyze)
|
v
Agent (Groq LLM + Hindsight memory)
|
v
Hindsight Cloud (1,000+ facts, 180 observations, 5,000+ links)

## Stack

| Layer | Technology |
|-------|-----------|
| Memory | Hindsight Cloud |
| LLM | Groq (openai/gpt-oss-120b) |
| Backend | FastAPI |
| Frontend | Vanilla HTML/CSS/JS |
| Dataset | OpenSRE (114 real incidents) |

## Run Locally

1. `pip install -r requirements.txt`
2. Add keys to `.env` (see `.env.example`)
3. `uvicorn main:app --reload`
4. Open `http://127.0.0.1:8000/`

## Demo

**Query:** "Checkout service is throwing 500 errors. Recent deployment at 06:31. Should we roll back?"

**Response:** The agent explicitly warns against 3 trap actions:
1. DO NOT roll back the deployment
2. DO NOT restart the pods
3. DO NOT scale the deployment

It cites real incidents (Slack TGW saturation, GitHub failover rollback) as evidence.

## Evaluation

Tested on 10 incidents with known root causes and trap actions from the OpenSRE dataset.

| # | Incident | Root Cause | Trap Warning | Real Incident Cited |
|---|----------|-----------|--------------|---------------------|
| 1 | Redis latency spike | Yes | Yes | 2026-09-27 |
| 2 | Checkout 500 after deploy | Yes | Yes | 2026-09-28 (systemd) |
| 3 | Redis cluster latency | Yes | Yes | payments-api, auth-service |
| 4 | BGP route reorder | Yes | Yes | Cloudflare 2022-06-21 |
| 5 | DNS zone corruption | Yes | Yes | 2026-09-28 |
| 6 | K8s CrashLoopBackOff | Yes | Yes | version-skew incidents |
| 7 | DB connection pool | Yes | Yes | auth-service 503 |
| 8 | systemd CNI flush | Yes | Yes | 2023-03-08 |
| 9 | HPA mis-scale | Yes | Yes | Slack 2021-01-04 |
| 10 | WAF manual edit | Yes | Yes | 2025-04-04 |

**Score: 10/10 root causes correct, 10/10 trap warnings, 10/10 real incident citations.**

## Data Sources

- 5 synthetic seed incidents (for controlled demo)
- 114 real incidents from [OpenSRE](https://huggingface.co/datasets/quantranger/opensre-incident-trajectories)

## Links

- [Hindsight GitHub repository](https://github.com/vectorize-io/hindsight)
- [Hindsight documentation](https://hindsight.vectorize.io/)
- [Agent memory explained](https://vectorize.io/what-is-agent-memory)