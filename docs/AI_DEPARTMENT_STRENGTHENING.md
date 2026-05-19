# AI Department Strengthening Plan

Status: Planning OS V6 foundation, 19 May 2026.

This document turns the eight-area assessment into an operating roadmap for the Gerai app and Atmaja backend.

## Baseline

| Area | Current | Target | Primary Gap |
| --- | ---: | ---: | --- |
| Konsep Department | 98% | 100% | Lock final authority matrix. |
| App / Dashboard | 86% | 100% | Add server-side planning tasks and due dates. |
| Rich Visual Output | 88% | 100% | Validate real Atmaja output as planning-grade `BriefBlock[]`. |
| Agent Runtime | 78% | 100% | Expose authenticated runtime health and job metrics from droplet. |
| Integrasi App ke Agent | 58% | 100% | Configure webhook and add queue/result polling. |
| Memory Bisnis | 78% | 100% | Build memory audit surface. |
| Automation Workflow | 74% | 100% | Add backend routing, approvals, archive, and weekly planning automation. |
| Security & Reliability | 58% | 100% | Close insecure OpenClaw control UI, add auth boundary, backups, logs. |

## Contract Direction

The app now has `AgentOutputEnvelope` v1 in `src/lib/agentContracts.ts`.

Every real agent response should eventually return:

- `summary`
- `planningFrame`
- `blocks: BriefBlock[]`
- `qualityGates`
- `nextActions`
- `memoryPolicy`

This keeps the app independent from Discord-style chat and prepares the app for OpenClaw, n8n, or a custom backend.

## Planning OS V6

Atmaja and the C-level skills now have Planning OS instructions:

- Atmaja acts as Chief Planner, not a chat responder.
- COO, CMO, CFO, and CCO output planning briefs with objective, current state, Plan A, Plan B, risks, decision needed, and next actions.
- Web Researcher has been added back to the registry under CCO.
- The app now displays Planner Council, Planning Rituals, and Communication Standard sections.

North Star: 100% planning system, where every brief becomes a plan, every plan has a decision gate, and every decision produces a next action.

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
