# AI Department Strengthening Plan

Status: implementation baseline, 19 May 2026.

This document turns the eight-area assessment into an operating roadmap for the Gerai app and Atmaja backend.

## Baseline

| Area | Current | Target | Primary Gap |
| --- | ---: | ---: | --- |
| Konsep Department | 80% | 92% | Lock role authority and escalation rules. |
| App / Dashboard | 55% | 85% | Connect dashboard cards to real agent jobs. |
| Rich Visual Output | 45% | 88% | Require agent output as `BriefBlock[]`, not plain text. |
| Agent Runtime | 50% | 82% | Add server health, complete missing specialist registry, monitor OpenClaw. |
| Integrasi App ke Agent | 20% | 80% | Build API bridge for submit, queue, polling, result return. |
| Memory Bisnis | 60% | 86% | Separate permanent knowledge from temporary interaction traces. |
| Automation Workflow | 35% | 82% | Add routing, approval, archive, and notification workflow. |
| Security & Reliability | 40% | 84% | Close insecure control UI, add auth boundary, backups, logs. |

## Contract Direction

The app now has `AgentOutputEnvelope` v1 in `src/lib/agentContracts.ts`.

Every real agent response should eventually return:

- `summary`
- `blocks: BriefBlock[]`
- `qualityGates`
- `nextActions`
- `memoryPolicy`

This keeps the app independent from Discord-style chat and prepares the app for OpenClaw, n8n, or a custom backend.

## Next Engineering Milestones

1. Backend bridge:
   `POST /api/briefs` creates a job and routes it to Atmaja.

2. Job polling:
   `GET /api/briefs/:id` returns job status and final `AgentOutputEnvelope`.

3. Agent registry:
   Server exposes active roles, missing roles, health, and last run status.

4. Memory audit:
   App shows business canon, decisions, Matthew preferences, and source logs separately from chat history.

5. Security pass:
   Disable insecure OpenClaw control UI, add authenticated app-to-server calls, and keep Discord optional.
