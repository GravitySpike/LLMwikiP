# Agent Decision Journal

## 2026-05-20: Initial LLM Wiki Construction

### Context

The project started with raw PDFs in `Raw/` and no application code. The goal was to turn raw course material into a persistent LLM Wiki.

### Decision

Build a deterministic local ingest pipeline before adding any LLM API dependency.

### Reasoning

The MVP needed to be reproducible in a classroom submission environment. A local PDF extraction and Markdown generation step is easier to test than an external LLM workflow.

### Result

Created `scripts/build-llm-wiki.js`, which:

- Reads PDFs from `Raw/`
- Extracts text with `pdf-parse`
- Generates `wiki/sources/`
- Generates `wiki/concepts/`
- Generates `wiki/index.md`, `wiki/overview.md`, `wiki/log.md`
- Stores extracted text and metadata under `.llm-wiki/`

## 2026-05-27: Wiki-First Answering Rule

### Context

The user asked for answers to be based on the built wiki first, and to use web search only when the wiki lacks information.

### Decision

Treat the local wiki as the primary knowledge source.

### Result

The agent answered questions by reading local concept/source pages first. When "Harness Engineering" was missing as a named page, it was added as a concept page derived from existing `Harness and Skills` and `Agent pool and Orchestrator` evidence.

## 2026-06-14: Assignment Direction

### Context

The assignment requires a Wiki Tool based on an MCP server, plus documentation and an MVP image.

### Decision

Extend the existing wiki into a small serving application and MCP-style tool server.

### Alternatives Considered

- Full React app: rejected for MVP because it adds build complexity.
- External database: rejected because Markdown files are enough for the assignment.
- Hosted LLM chatbot: postponed because the MVP can demonstrate wiki-grounded answering without API keys.

### Result

Added:

- Shared wiki access module: `scripts/wiki-core.js`
- MCP server: `mcp/wiki-mcp-server.js`
- GUI server: `app/server.js`
- Browser UI: `app/public/`

## Current Risk Notes

- Korean text extraction from some PDFs is imperfect, so generated pages prefer readable extracted lines.
- The chatbot is retrieval-based, not a live LLM call.
- `propose_wiki_edit` is planned but not enabled in this MVP to avoid unreviewed writes.
