// Gerai Master Router — n8n Workflow SDK code
//
// Entry point untuk semua webhook-triggered request dari PWA Atmaja.
// Flow: Webhook → Validate+Classify → Switch by intent (10 cases) → Build Response → Respond OK
//
// BEFORE FIRST DEPLOY — set n8n Variables di UI (Settings → Variables):
//   - GERAI_API_BASE = https://gerai.mahewwork.com
//   - N8N_BEARER_TOKEN = decbcce50261ac5200cca67f66089074422504e204049cc52c5a0eb4243bf26c
//
// Routes (payload.type):
//   0=brief, 1=chat, 2=schedule_create, 3=proposal_submit, 4=image_gen,
//   5=browse, 6=scrape, 7=exec, 8=skill_propose, 9=health
//
// Test: curl -X POST https://mahewai.app.n8n.cloud/webhook/gerai-master \
//   -H "Authorization: Bearer <N8N_BEARER_TOKEN>" \
//   -H "Content-Type: application/json" \
//   -d '{"type":"chat","userMessage":"halo Atmaja"}'

import { workflow, node, trigger, switchCase } from '@n8n/workflow-sdk'

// ---------- TRIGGER ----------

const webhookEntry = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook Master Router',
    parameters: {
      httpMethod: 'POST',
      path: 'gerai-master',
      responseMode: 'responseNode',
      options: {},
    },
  },
})

// ---------- VALIDATE BEARER + CLASSIFY INTENT ----------

const validateAndClassify = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validate Bearer + Classify Intent',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "const raw = $input.first().json;\nconst headers = raw.headers || {};\nconst authHeader = String(headers.authorization || headers.Authorization || '');\nconst expected = 'Bearer ' + ($vars.N8N_BEARER_TOKEN || 'decbcce50261ac5200cca67f66089074422504e204049cc52c5a0eb4243bf26c');\n\nif (authHeader !== expected) {\n  throw new Error('unauthorized_missing_or_invalid_bearer_token');\n}\n\nconst body = raw.body || {};\n\nconst data = (body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload))\n  ? Object.assign({}, body.payload, { jobId: body.jobId, source: body.source })\n  : body;\n\nconst validTypes = new Set(['brief','chat','schedule_create','proposal_submit','image_gen','browse','scrape','exec','skill_propose','health']);\n\nconst type = String(data.type || '').trim().toLowerCase();\nif (!type) {\n  throw new Error('missing_type_field — must be one of: ' + Array.from(validTypes).join(', '));\n}\nif (!validTypes.has(type)) {\n  throw new Error('invalid_type_' + type);\n}\n\nconst requestId = data.requestId || ('req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));\nconst jobId = data.jobId || requestId;\nconst gerai = $vars.GERAI_API_BASE || 'https://gerai.mahewwork.com';\n\nreturn [{\n  json: {\n    type,\n    payload: data,\n    jobId,\n    requestId,\n    source: data.source || 'unknown',\n    receivedAt: Date.now(),\n    callbackUrl: data.callbackUrl || (gerai + '/api/agent/briefs?action=result'),\n  }\n}];",
    },
  },
})

// ---------- SWITCH BY INTENT (10 cases) ----------
// Note: onCase() uses NUMERIC INDEX (0-based). outputKey label hanya untuk UI clarity.

const switchByIntent = switchCase({
  version: 3.2,
  config: {
    name: 'Route by Intent',
    parameters: {
      rules: {
        values: [
          { outputKey: 'brief', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.type }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'brief' }], combinator: 'and' } },
          { outputKey: 'chat', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.type }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'chat' }], combinator: 'and' } },
          { outputKey: 'schedule_create', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.type }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'schedule_create' }], combinator: 'and' } },
          { outputKey: 'proposal_submit', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.type }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'proposal_submit' }], combinator: 'and' } },
          { outputKey: 'image_gen', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.type }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'image_gen' }], combinator: 'and' } },
          { outputKey: 'browse', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.type }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'browse' }], combinator: 'and' } },
          { outputKey: 'scrape', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.type }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'scrape' }], combinator: 'and' } },
          { outputKey: 'exec', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.type }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'exec' }], combinator: 'and' } },
          { outputKey: 'skill_propose', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.type }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'skill_propose' }], combinator: 'and' } },
          { outputKey: 'health', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: '={{ $json.type }}', operator: { type: 'string', operation: 'equals' }, rightValue: 'health' }], combinator: 'and' } },
        ],
      },
    },
  },
})

// ---------- BRANCH HANDLERS ----------
// All branches converge to buildResponse → respondOk

// Branch 0: brief → forward ke W1 webhook (chained, sub-workflow style)
const handleBrief = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Brief: Forward to W1',
    parameters: {
      method: 'POST',
      url: 'https://mahewai.app.n8n.cloud/webhook/gerai-brief-submit',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'Authorization', value: '=Bearer {{ $vars.N8N_BEARER_TOKEN }}' }, { name: 'Content-Type', value: 'application/json' }] },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: { timeout: 180000, response: { response: { neverError: true } } },
    },
  },
})

// Branch 1: chat → /api/atmaja/chat
const handleChat = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Chat: POST /api/atmaja/chat',
    parameters: {
      method: 'POST',
      url: '={{ $vars.GERAI_API_BASE || "https://gerai.mahewwork.com" }}/api/atmaja/chat',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'Authorization', value: '=Bearer {{ $vars.N8N_BEARER_TOKEN }}' }, { name: 'Content-Type', value: 'application/json' }] },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: { timeout: 90000, response: { response: { neverError: true } } },
    },
  },
})

// Branch 2: schedule_create → /api/atmaja/memory?type=schedule&action=create
const handleScheduleCreate = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Schedule Create',
    parameters: {
      method: 'POST',
      url: '={{ $vars.GERAI_API_BASE || "https://gerai.mahewwork.com" }}/api/atmaja/memory?type=schedule&action=create',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'Authorization', value: '=Bearer {{ $vars.N8N_BEARER_TOKEN }}' }, { name: 'Content-Type', value: 'application/json' }] },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: { timeout: 15000, response: { response: { neverError: true } } },
    },
  },
})

// Branch 3: proposal_submit → /api/atmaja/memory?type=proposals&action=create
const handleProposalSubmit = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Proposal Submit',
    parameters: {
      method: 'POST',
      url: '={{ $vars.GERAI_API_BASE || "https://gerai.mahewwork.com" }}/api/atmaja/memory?type=proposals&action=create',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'Authorization', value: '=Bearer {{ $vars.N8N_BEARER_TOKEN }}' }, { name: 'Content-Type', value: 'application/json' }] },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: { timeout: 15000, response: { response: { neverError: true } } },
    },
  },
})

// Branch 4: image_gen → /api/openai/image
const handleImageGen = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Image Gen',
    parameters: {
      method: 'POST',
      url: '={{ $vars.GERAI_API_BASE || "https://gerai.mahewwork.com" }}/api/openai/image',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'Authorization', value: '=Bearer {{ $vars.N8N_BEARER_TOKEN }}' }, { name: 'Content-Type', value: 'application/json' }] },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: { timeout: 120000, response: { response: { neverError: true } } },
    },
  },
})

// Branch 5: browse → /api/agent/browse
const handleBrowse = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Browse',
    parameters: {
      method: 'POST',
      url: '={{ $vars.GERAI_API_BASE || "https://gerai.mahewwork.com" }}/api/agent/browse',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'Authorization', value: '=Bearer {{ $vars.N8N_BEARER_TOKEN }}' }, { name: 'Content-Type', value: 'application/json' }] },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: { timeout: 30000, response: { response: { neverError: true } } },
    },
  },
})

// Branch 6: scrape → /api/agent/browse + schema
const handleScrape = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Scrape +schema',
    parameters: {
      method: 'POST',
      url: '={{ $vars.GERAI_API_BASE || "https://gerai.mahewwork.com" }}/api/agent/browse',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'Authorization', value: '=Bearer {{ $vars.N8N_BEARER_TOKEN }}' }, { name: 'Content-Type', value: 'application/json' }] },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: { timeout: 30000, response: { response: { neverError: true } } },
    },
  },
})

// Branch 7: exec → /api/atmaja/exec
const handleExec = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Sandbox Exec',
    parameters: {
      method: 'POST',
      url: '={{ $vars.GERAI_API_BASE || "https://gerai.mahewwork.com" }}/api/atmaja/exec',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'Authorization', value: '=Bearer {{ $vars.N8N_BEARER_TOKEN }}' }, { name: 'Content-Type', value: 'application/json' }] },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.payload) }}',
      options: { timeout: 60000, response: { response: { neverError: true } } },
    },
  },
})

// Branch 8: skill_propose → /api/atmaja/memory?type=proposals (type=skill di body)
const handleSkillPropose = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Skill Propose',
    parameters: {
      method: 'POST',
      url: '={{ $vars.GERAI_API_BASE || "https://gerai.mahewwork.com" }}/api/atmaja/memory?type=proposals&action=create',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'Authorization', value: '=Bearer {{ $vars.N8N_BEARER_TOKEN }}' }, { name: 'Content-Type', value: 'application/json' }] },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify(Object.assign({}, $json.payload, { type: "skill" })) }}',
      options: { timeout: 15000, response: { response: { neverError: true } } },
    },
  },
})

// Branch 9: health → /api/agent/health
const handleHealth = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Health Check',
    parameters: {
      method: 'GET',
      url: '={{ $vars.GERAI_API_BASE || "https://gerai.mahewwork.com" }}/api/agent/health',
      options: { timeout: 15000, response: { response: { neverError: true } } },
    },
  },
})

// ---------- BUILD RESPONSE ENVELOPE ----------

const buildResponse = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Response Envelope',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "const result = $input.first().json || {};\nconst meta = $('Validate Bearer + Classify Intent').first().json || {};\nconst completedAt = Date.now();\nconst durationMs = completedAt - (meta.receivedAt || completedAt);\n\nreturn [{\n  json: {\n    ok: !!(result && (result.ok !== false)),\n    requestId: meta.requestId,\n    jobId: meta.jobId,\n    type: meta.type,\n    source: meta.source,\n    durationMs,\n    completedAt,\n    result,\n    callbackUrl: meta.callbackUrl,\n  }\n}];",
    },
  },
})

// ---------- RESPOND ----------

const respondOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond OK',
    parameters: {
      respondWith: 'firstIncomingItem',
      options: {},
    },
  },
})

// ---------- COMPOSE WORKFLOW ----------
// onCase uses NUMERIC INDEX (0-based), matching rule order in switchByIntent.values
// 0=brief, 1=chat, 2=schedule_create, 3=proposal_submit, 4=image_gen,
// 5=browse, 6=scrape, 7=exec, 8=skill_propose, 9=health

export default workflow('gerai-00-master-router', 'Gerai 00 - Master Router')
  .add(webhookEntry)
  .to(validateAndClassify)
  .to(
    switchByIntent
      .onCase(0, handleBrief.to(buildResponse))
      .onCase(1, handleChat.to(buildResponse))
      .onCase(2, handleScheduleCreate.to(buildResponse))
      .onCase(3, handleProposalSubmit.to(buildResponse))
      .onCase(4, handleImageGen.to(buildResponse))
      .onCase(5, handleBrowse.to(buildResponse))
      .onCase(6, handleScrape.to(buildResponse))
      .onCase(7, handleExec.to(buildResponse))
      .onCase(8, handleSkillPropose.to(buildResponse))
      .onCase(9, handleHealth.to(buildResponse)),
  )
  .add(buildResponse)
  .to(respondOk)
