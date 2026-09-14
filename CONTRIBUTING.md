# Contributing to JTK25 Jadwal API

## Workflow

1. **Fork** this repository
2. Create a branch: `update-<topic>` (e.g. `update-schedule-parser`)
3. Make your changes
4. Ensure JSON data passes validation (`npm run validate`)
5. Submit a **Pull Request**

## Guidelines

- **One class per PR** — keep changes focused and reviewable
- JSON schedule files must conform to the v2 schema
- Run the validator before submitting: `npm run validate`

## Development

```bash
npm install
npm run dev        # starts wrangler dev server
npm run deploy     # deploys to Cloudflare (manual only, no CI)
```
