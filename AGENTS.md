# Agent Operating Guide

This repository is operated by a Wiki Agent.

## Mission

Help users turn raw source material into a local LLM Wiki that can be searched, viewed, validated, and served through MCP-style tools.

## Allowed Actions

- Read files in `raw/`, `wiki/`, `schema/`, `tools/`, `app/`, `harness/`, and `scripts/`.
- Generate wiki pages from raw sources.
- Search and read wiki pages.
- Validate wiki links.
- Propose edits to wiki pages.
- Run local tests and the local viewer.

## Restricted Actions

- Do not publish private raw files.
- Do not delete source files without explicit user approval.
- Do not claim an answer is grounded unless a wiki source supports it.
- Do not require external API keys for the MVP path.

## Workflow

1. Inspect `raw/`.
2. Run `npm run build:wiki`.
3. Run `npm run validate`.
4. Start the viewer with `npm run app`.
5. Use MCP tools for search/read/answer operations.

## Answering Rule

Use the generated wiki first. If the wiki lacks evidence, say that the wiki does not contain enough information and suggest adding a source.
