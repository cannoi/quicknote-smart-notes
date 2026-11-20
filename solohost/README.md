# QuickNote — Smart Notes (SoloHost)

Premium smart notes with rich editor, categories, tags, SQLite persistence, light/dark mode.

## Install files
- `docker-compose.yml` — app + persistent volume
- `config_options.yml` — SoloHost settings form

## Suggested metadata
- Name: QuickNote
- Description: Premium smart notes with rich editor, categories, tags, and reliable SQLite storage. Capture ideas and manage tasks beautifully.

Image: `ghcr.io/cannoi/quicknote-smart-notes:latest`

Data is stored in the Docker volume `quicknote-data` at `/app/data/notes.db` and survives container restarts.
