# Notion Import (gitignored)

Letakkan Notion export markdown di sini. Folder ini di-gitignore — content tidak ter-commit ke repo (privacy: bisa berisi vendor name, supplier deal, financial yang sensitif).

## Cara pakai

1. Di Notion, buka page top-level 'AI Department' atau folder yang mau diaudit
2. Klik ⋯ (titik tiga kanan atas) → Export → format **Markdown & CSV**
3. Centang **Include subpages** + **Create folders for subpages**
4. Klik Export → download zip
5. Ekstrak isi zip ke folder ini (`notion-import/`)
6. Struktur akhir kurang lebih:
   ```
   notion-import/
   ├── AI Department.md
   ├── AI Department/
   │   ├── 1. Atmaja.md
   │   ├── 2. C-Suite.md
   │   └── ...
   └── ...
   ```
7. Bilang ke Claude 'notion siap di folder'

Claude akan audit dengan checklist di `docs/AI_DEPARTMENT_AUDIT_TEMPLATE.md` dan output ke `notion-export-updated/` (juga gitignored).

