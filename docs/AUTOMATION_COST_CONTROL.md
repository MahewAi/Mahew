# Gerai Automation and Cost Control

Status: live app layer, 20 May 2026.

This note documents the automation loop and cost dashboard added to Gerai so AI Department work can stay observable without exposing private case data.

## Case Automation Loop

Name: Case intelligence loop

Kind: manual-runbook with live app state. Every new case submitted in the app creates a local automation run.

Trigger: a new `Brief` from the compose sheet.

Skill owner: `skill-automation` for workflow design, Atmaja for orchestration.

Steps:

- Framing case: Atmaja reads objective, constraints, and decision needed.
- Route C-level: Atmaja assigns the owner lane.
- Planning reasoning: owner lane turns the case into a planning frame.
- Evidence and risk check: specialist lane checks assumptions and blockers.
- Output contract: Atmaja prepares final summary, quality gates, and next action.

Allowed actions:

- Update local app state.
- Persist run status in localStorage.
- Show progress, completed, and blocked counts in the intelligence dashboard.

Approval gates:

- External publishing.
- Spending.
- Credential use.
- Destructive edits.
- Turning off privacy lock.
- Production deploys.

Failure mode:

- A case in review blocks the run.
- If localStorage is unavailable, the app still works but the run history is not persisted.
- Server-side automation should not be enabled until authenticated job polling exists.

## Cost and Credit Dashboard

The new cost sector estimates local case cost and reads provider credits through a server endpoint.

Provider: OpenRouter.

Endpoint: `GET /api/openrouter/credits`.

Secret: `OPENROUTER_MANAGEMENT_KEY`.

The browser never receives the OpenRouter key. The browser only calls the same-origin endpoint, and the server endpoint calls OpenRouter's credits API. The endpoint sends no Gerai case text, no local memory, and no brief payload to OpenRouter.

Returned fields:

- `totalCredits`
- `totalUsage`
- `remainingCredits`
- `status`
- `updatedAt`

If the key is missing, the dashboard shows local estimates and a not-configured provider status.

## Verification

Skill health:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/skill-automation/scripts/audit-skills.ps1
```

Build:

```powershell
npm run typecheck
npm run build
```

Provider setup:

1. Add `OPENROUTER_MANAGEMENT_KEY` to Vercel as a server-side environment variable.
2. Do not create a `VITE_` version of the key.
3. Keep `VITE_GERAI_PRIVACY_LOCK=on` unless the runtime has passed security review.
