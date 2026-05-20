export function isAtmajaColorDecisionRequest(text: string) {
  const lowerText = text.toLowerCase()
  return /(warna|color|palette|palet|brand|branding)/.test(lowerText) && /(pilih|rekomendasi|terbaik|alasan|menurut)/.test(lowerText)
}

export function isAtmajaDirectVisualChoiceRequest(text: string) {
  const lowerText = text.toLowerCase()
  return (
    (/(yang saya tanya|saya tanya|jawab langsung|jangan muter)/.test(lowerText) &&
      /(foto|gambar|opsi|option|warna|color|palette|palet|pilihan|pilih)/.test(lowerText)) ||
    (/(foto|gambar|opsi|option)/.test(lowerText) && /(mana|keberapa|ke berapa|suka|pilihan|prefer)/.test(lowerText)) ||
    (/(mana|keberapa|ke berapa|pilihan)/.test(lowerText) && /(foto|gambar|opsi|option)/.test(lowerText)) ||
    (/(warna|color|palette|palet)/.test(lowerText) && /(mana|suka|pilihan|prefer)/.test(lowerText))
  )
}

export function isGenericAtmajaFileReply(text: string) {
  return (
    text.startsWith('Lampiran masuk. Jika ini dokumen non-teks') ||
    text.startsWith('File sudah saya terima sebagai lampiran.')
  )
}

export function isGenericAtmajaVisualReply(text: string) {
  return (
    text.startsWith('Bisa. Saya akan jawab dalam dua lapis') ||
    text.startsWith('Bisa. Saya akan sertakan draft visual awal')
  )
}

export function isGenericAtmajaBrandReply(text: string) {
  return (
    text.startsWith('Brand Gerai tetap saya pegang') ||
    text.startsWith('Kalau mau mulai dari brand') ||
    text.includes('brief pertamanya bisa berbentuk identity canon')
  )
}

export function shouldRepairAtmajaReply(userText: string, replyText: string, hasVisuals: boolean) {
  return (
    (isAtmajaColorDecisionRequest(userText) &&
      (isGenericAtmajaFileReply(replyText) || isGenericAtmajaVisualReply(replyText) || !hasVisuals)) ||
    (isAtmajaDirectVisualChoiceRequest(userText) && isGenericAtmajaBrandReply(replyText))
  )
}
