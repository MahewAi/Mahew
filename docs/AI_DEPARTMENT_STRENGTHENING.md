# AI Department Strengthening Plan

Status: bridge foundation, 19 May 2026.

This document turns the eight-area assessment into an operating roadmap for the Gerai app and Atmaja backend.

## Baseline

| Area | Current | Target | Primary Gap |
| --- | ---: | ---: | --- |
| Konsep Department | 84% | 92% | Lock role authority and escalation rules. |
| App / Dashboard | 68% | 85% | Connect dashboard cards to real agent jobs. |
| Rich Visual Output | 66% | 88% | Validate real Atmaja output as `BriefBlock[]`. |
| Agent Runtime | 58% | 82% | Expose authenticated runtime health from droplet. |
| Integrasi App ke Agent | 48% | 80% | Configure webhook and add queue/result polling. |
| Memory Bisnis | 66% | 86% | Build memory audit surface. |
| Automation Workflow | 55% | 82% | Add backend routing, approvals, archive, and notification workflow. |
| Security & Reliability | 48% | 84% | Close insecure OpenClaw control UI, add auth boundary, backups, logs. |

## Contract Direction

The app now has `AgentOutputEnvelope` v1 in `src/lib/agentContracts.ts`.

Every real agent response should eventually return:

- `summary`
- `blocks: BriefBlock[]`
- `qualityGates`
- `nextActions`
- `memoryPolicy`

This keeps the app independent from Discord-style chat and prepares the app for OpenClaw, n8n, or a custom backend.

## Bridge Foundation

The app now has two serverless bridge endpoints:

- `POST /api/agent/briefs`
- `GET /api/agent/health`

Environment variables for production:

- `ATMAJA_BRIEF_WEBHOOK_URL`: webhook target for Atmaja, n8n, or a custom backend.
- `ATMAJA_BRIDGE_TOKEN`: optional bearer token sent from the bridge to the webhook.

If the webhook is not configured, the app uses `contract` mode. This is intentional: Matthew can keep using the app while the runtime integration is being wired.

## Next Engineering Milestones

1. Configure production bridge:
   Set `ATMAJA_BRIEF_WEBHOOK_URL` and `ATMAJA_BRIDGE_TOKEN` in Vercel.

2. Job polling:
   `GET /api/agent/jobs/:id` returns job status and final `AgentOutputEnvelope`.

3. Agent registry:
   Server exposes active roles, missing roles, health, and last run status.

4. Memory audit:
   App shows business canon, decisions, Matthew preferences, and source logs separately from chat history.

5. Security pass:
   Disable insecure OpenClaw control UI, add authenticated app-to-server calls, and keep Discord optional.
