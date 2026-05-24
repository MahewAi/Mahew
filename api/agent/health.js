const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

export default function handler(_req, res) {
  const hasWebhook = Boolean(process.env.ATMAJA_BRIEF_WEBHOOK_URL)
  const hasToken = Boolean(process.env.ATMAJA_BRIDGE_TOKEN)
  const openRouterChatEnabled = process.env.ATMAJA_OPENROUTER_ENABLED === 'true'
  const openRouterKeyConfigured = Boolean(process.env.OPENROUTER_API_KEY)
  const openRouterModel = process.env.ATMAJA_OPENROUTER_MODEL ?? process.env.OPENROUTER_CHAT_MODEL ?? null
  const openAIKeyConfigured = Boolean(process.env.OPENAI_API_KEY)
  const allowedHosts = String(process.env.ATMAJA_WEBHOOK_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

  res.writeHead(200, jsonHeaders)
  res.end(
    JSON.stringify({
      ok: true,
      checkedAt: new Date().toISOString(),
      bridge: {
        mode: hasWebhook ? 'webhook' : 'contract',
        submitEndpoint: '/api/agent/briefs',
        webhookConfigured: hasWebhook,
        tokenConfigured: hasToken,
        tokenRequired: hasWebhook,
        webhookHostAllowlistConfigured: allowedHosts.length > 0,
      },
      chat: {
        provider: 'OpenRouter',
        endpoint: '/api/atmaja/chat',
        memoryEndpoint: '/api/atmaja/memory',
        filesEndpoint: '/api/atmaja/memory?type=files',
        enabled: openRouterChatEnabled && openRouterKeyConfigured,
        keyConfigured: openRouterKeyConfigured,
        model: openRouterModel,
        // Server endpoint support vision_inline (image base64), pdf_native (PDF base64 via
        // OpenRouter file content block), text_preview_inline (cuplikan teks file),
        // long-term memory file (Vercel KV), dan file library persistence (Vercel Blob).
        attachmentsPolicy: 'vision_pdf_native_or_text_preview',
        capabilities: {
          imageVision: true,
          pdfNative: true,
          textPreview: true,
          longTermMemory: Boolean(process.env.KV_REST_API_URL ?? process.env.KV_URL),
          memoryAutoUpdate: true,
          memoryBackup: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
          fileLibrary: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
          skillProposals: Boolean(process.env.KV_REST_API_URL ?? process.env.KV_URL),
          historyMaxMessages: 100,
          historyMaxCharsPerMessage: 15_000,
          maxImageBase64Bytes: 2_100_000,
          maxImagesPerTurn: 2,
          maxPdfBase64Bytes: 3_500_000,
          maxPdfsPerTurn: 1,
          maxFileAttachedPerTurn: 3,
          maxTextPreviewChars: 30_000,
        },
        endpoints: {
          chat: '/api/atmaja/chat',
          memory: '/api/atmaja/memory',
          files: '/api/atmaja/memory?type=files',
          backup: '/api/atmaja/memory?type=backup',
          proposals: '/api/atmaja/memory?type=proposals',
        },
      },
      // Warnings yang client (PWA) bisa display sebagai banner ke Matthew.
      // Saat ini cek manual via /api/openrouter/credits + thresholds. Real-time
      // warning generation butuh KV cache supaya tidak hit OpenRouter setiap load.
      warnings: [
        // Will be populated di runtime kalau ada (e.g., credit low, env missing)
      ],
      image: {
        provider: 'OpenAI',
        endpoint: '/api/openai/image',
        enabled: openAIKeyConfigured,
        keyConfigured: openAIKeyConfigured,
        modelsSupported: [
          'gpt-image-1',
          'gpt-image-1-mini',
          'gpt-image-1.5',
          'gpt-image-2',
          'gpt-image-2-2026-04-21',
          'chatgpt-image-latest',
          'dall-e-3 (legacy, may 404 on newer accounts)',
        ],
        creditsEndpoint: '/api/openai/credits',
      },
      runtime: {
        engine: 'OpenClaw Atmaja',
        status: 'external',
        note: 'Runtime health detail perlu endpoint authenticated dari droplet.',
      },
      security: {
        appFirst: true,
        discordOptional: true,
        privacyLock: process.env.VITE_GERAI_PRIVACY_LOCK !== 'off',
        bridgeRequiresHttps: true,
        bridgeRequiresBearerToken: true,
        requiresServerAudit: true,
      },
    }),
  )
}
