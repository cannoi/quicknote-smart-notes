# QuickNote — Smart Notes

Premium note-taking and task management application with SQLite persistence, rich editor, categories, tags, and a polished modern UI.

## Features

- **Rich note editor** with headings, bold/italic/underline, lists, and checklists
- **Auto-save** while typing with clear save status
- **Pin, archive, restore, and delete** notes
- **Categories & tags** for organization
- **Instant search** across titles and content
- **Sort** by newest, oldest, recently updated, or alphabetical
- **Dashboard** with stats and recent activity
- **Light & Dark mode**
- **Fully responsive** (desktop, tablet, mobile)
- **SQLite** persistence with WAL mode — data survives restarts
- **Export** all notes as JSON
- **SoloHost / Docker** ready with persistent volume

## Quick start (local)

```bash
npm install
npm start
# Open http://localhost:8080
```

## Docker

```bash
docker compose up -d
```

Data is stored in the `quicknote-data` volume at `/app/data/notes.db`.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/stats` | Dashboard stats |
| GET | `/api/notes` | List notes (`?search=&category=&sort=&archived=`) |
| POST | `/api/notes` | Create note |
| GET/PUT/PATCH/DELETE | `/api/notes/:id` | Note CRUD |
| GET/POST/PUT/DELETE | `/api/categories` | Category management |
| GET | `/api/tags` | List tags |
| GET | `/api/export` | Download full export |

## Environment

- `PORT` — listen port (default `8080`)
