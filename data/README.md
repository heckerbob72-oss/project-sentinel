# data/

Runtime data lives here (git-ignored):

- `../backend/sentinel.db` — local SQLite database (created by the seed command)
- `../backend/storage/` — uploaded documents (per-project subfolders)
- `../backend/.chroma/` — local ChromaDB persistence (if enabled)

Seed the demo dataset with:

```bash
cd backend && python -m app.seed.run_seed
```

See `../samples/sample_project.json` for a portable copy of the demo project,
team, tasks, and dependencies you can POST to the API.
