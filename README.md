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

## Team Content

Content published by team members:
## Team Content

Content published by team members:

| # | Member | Article | LinkedIn Post |
|---|--------|---------|---------------|
| 1 | Bhavitha | [How Hindsight Stopped My LLM From Fabricating kubectl Output](https://dev.to/bhavitha_3f5773ee89df1aec/how-hindsight-stopped-my-llm-from-fabricating-kubectl-output-5jp) | [LinkedIn](https://lnkd.in/p/d7D4ibAY) |
| 2 | Saikeerthika | [What 104 Real Postmortems Taught My Agent](https://dev.to/kudikala_saikeerthika_672/what-104-real-postmortems-taught-my-agent-that-i-couldnt-have-written-myself-3n8j) | [LinkedIn](https://lnkd.in/p/drhVaH_u) |
| 3 | Khethana | [What I Used Hindsight's reflect and recall For](https://dev.to/khethana_fd6ed47eb3fe846a/what-i-used-hindsights-reflect-and-recall-for-and-what-i-havent-proven-about-them-1gn4) | [LinkedIn](https://lnkd.in/p/dAhDSZzr) |
| 4 | Shivaleela | [Five Steps Between an Incident Description and a "DO NOT"](https://dev.to/a_shivaleela_e7c88f17c3f0/five-steps-between-an-incident-description-and-a-do-not-3343) | [LinkedIn](https://lnkd.in/p/d_PAxqBV) |
| 5 | Poojitha | [The Most Useful Thing My Incident Agent Says Is "Don't"](https://dev.to/poojitha_narkatpally_fe23/the-most-useful-thing-my-incident-agent-says-is-dont-ape) | [LinkedIn](https://www.linkedin.com/posts/poojitha-narkatpally-a87985345_aiagents-ai-hindsight-ugcPost-7510718169901297665-gPWX/) |
| 6 | Sravya | [My First 10/10 Was a Lie: How I Tested an SRE Agent Properly](https://dev.to/sravya_marikokkula_dea1b7/my-first-1010-was-a-lie-how-i-tested-an-sre-agent-properly-466e) | [LinkedIn](https://lnkd.in/p/djkAtqyC) |

All 6 team members have published an article and a LinkedIn post. Video: [YouTube](https://youtu.be/ocWeWGfW5ik?si=CmVo1Ls4lTQAjUls)
[Reddit post](https://www.reddit.com/r/LLMDevs/comments/1wta6s8/my_llm_fabricated_kubectl_output_postmortem/)
