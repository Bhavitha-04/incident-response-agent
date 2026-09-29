# Incident Response Agent

An AI agent that learns from real production outages using Hindsight memory.

## What It Does

- Recalls past incidents from 104 real postmortems (Slack, Cloudflare, GitHub, AWS, Datadog, CircleCI, LaunchDarkly)
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
Hindsight Cloud (759 world facts, 182 observations, 7,135 links)

## Stack

| Layer | Technology |
|-------|-----------|
| Memory | Hindsight Cloud |
| LLM | Groq (openai/gpt-oss-120b) |
| Backend | FastAPI |
| Frontend | Vanilla HTML/CSS/JS |
| Dataset | OpenSRE (104 seeded, 10 held out) |

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

### Hold-Out Test

We withheld 10 incidents from the memory bank entirely. The agent had never seen them.

| # | Incident | True Category | Memory Diagnosis | Correct? |
|---|----------|---------------|------------------|----------|
| 1 | slack_tgw_fd_exhaustion | network_fault | TGW saturation (11.8% packet loss) | Yes |
| 2 | cloudflare_1111_zonemd_stale_cache | config_error | Parser defect, RR type 63 ZONEMD | Yes |
| 3 | circleci_kubeproxy_iptables | network_fault | kube-proxy/kubelet version skew | Yes |
| 4 | cloudflare_byzantine_switch | network_fault | ToR switch partial failure | Yes |
| 5 | github_network_partition_orchestrator | network_fault | Optical uplink flap, Raft split-brain | Yes |
| 6 | github_cache_ttl_read_explosion | saturation | TTL reduction + client-read regression | Yes |
| 7 | github_mlag_stonith_splitbrain | network_fault | MLAG failover, STP reconvergence | Yes |
| 8 | slack_consul_cache_db_metastable | dependency_failure | Consul PBR restart, cache-ring churn | Yes |
| 9 | circleci_waf_manual_edit | config_error | IAM out-of-band WAF edit | Yes |
| 10 | circleci_waf_manual_edit | config_error | (Groq rate limit hit) | N/A |

**Score: 9/10 root causes correct on held-out incidents.**

### Baseline Comparison

Same 10 incidents, same LLM, no memory. The baseline hallucinated:
- Connection leaks that didn't exist (Test 1)
- TTL configuration errors (Test 2)
- Firewall ACL changes (Test 5)

**The memory version cited real incident patterns; the baseline invented causes.**

### Limitations

- Small sample (n=10)
- Groq free-tier rate limit affected test 10
- Trap-action warnings measured qualitatively, not with a rubric

## Data Sources

- 104 real incidents from [OpenSRE](https://huggingface.co/datasets/quantranger/opensre-incident-trajectories)
- 10 incidents held out for evaluation

## Links

- [Hindsight GitHub repository](https://github.com/vectorize-io/hindsight)
- [Hindsight documentation](https://hindsight.vectorize.io/)
- [Agent memory explained](https://vectorize.io/what-is-agent-memory)