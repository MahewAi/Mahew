# AI Department Strengthening Plan

Status: Planning OS V6 foundation, 19 May 2026.

This document turns the eight-area assessment into an operating roadmap for the Gerai app and Atmaja backend.

## Baseline

| Area | Current | Target | Primary Gap |
| --- | ---: | ---: | --- |
| Konsep Department | 98% | 100% | Lock final authority matrix. |
| App / Dashboard | 86% | 100% | Add server-side planning tasks and due dates. |
| Rich Visual Output | 104% | 110% | Enforce the same C-level work map schema in the real agent runtime. |
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
- C-level work map with lane, dependency, output artifact, and decision gate
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

The app can be wired to serverless bridge endpoints later, but production privacy lock keeps them blocked by default:

- `POST /api/agent/briefs`
- `GET /api/agent/health`

Environment variables for production:

- `VITE_GERAI_PRIVACY_LOCK`: keep `on` while AI Department data must stay local-only.
- `ATMAJA_BRIEF_WEBHOOK_URL`: webhook target for Atmaja, n8n, or a custom backend.
- `ATMAJA_BRIDGE_TOKEN`: required bearer token sent from the bridge to the webhook when webhook mode is enabled.
- `ATMAJA_WEBHOOK_ALLOWED_HOSTS`: optional comma-separated hostname allowlist for webhook targets.
- `GERAI_ALLOWED_ORIGINS`: optional comma-separated same-site origin allowlist for bridge callers.
- `ATMAJA_BRIEF_MAX_BYTES`: max JSON payload size for bridge requests.
- `ATMAJA_BRIDGE_RATE_LIMIT`: light per-IP request cap per minute.

If privacy lock is on, the browser does not post brief data to the bridge even if endpoint variables exist. This is intentional: Matthew can keep using the app while the runtime integration is being audited.

## Next Engineering Milestones

1. Configure production bridge:
   Only after a security review, set `VITE_GERAI_PRIVACY_LOCK=off`, `ATMAJA_BRIEF_WEBHOOK_URL`, `ATMAJA_BRIDGE_TOKEN`, and the webhook host allowlist in Vercel.

2. Job polling:
   `GET /api/agent/jobs/:id` returns job status and final `AgentOutputEnvelope`.

3. Agent registry:
   Server exposes active roles, missing roles, health, and last run status.

4. Visual work map enforcement:
   Every real COO, CMO, CFO, and CCO result must include a role-specific work map before long-form analysis.

5. Memory audit:
   App shows business canon, decisions, Matthew preferences, and source logs separately from chat history.

6. Security pass:
   Disable insecure OpenClaw control UI, add authenticated app-to-server calls, and keep Discord optional.
