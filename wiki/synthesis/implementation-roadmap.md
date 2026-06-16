---
type: synthesis
title: "Implementation Roadmap"
generated_at: "2026-06-16T00:49:04.463Z"
---

# Implementation Roadmap

## MVP

- Keep raw PDFs immutable in `Raw/`.
- Extract text into `.llm-wiki/extracted/` for repeatable ingest.
- Generate source pages under `wiki/sources/`.
- Generate concept pages under `wiki/concepts/`.
- Maintain `wiki/index.md`, `wiki/log.md`, and `wiki/overview.md`.

## Next Iteration

- Replace heuristic summaries with an LLM analysis step.
- Add a review queue before concept pages are overwritten.
- Store page-level citations and PDF page references.
- Add full-text search over generated Markdown and extracted source text.
- Add lint checks for broken links, orphan pages, stale claims, and source fidelity.
