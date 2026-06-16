# Harness Rules

## Repository Rules

- `raw/` contains user-provided source material.
- `wiki/` contains generated Markdown pages.
- `schema/` contains wiki maintenance rules.
- `tools/` contains agent-facing tools such as the MCP server.
- `app/` contains the local viewer.
- `demo/` contains a screenshot proving the tool renders a real knowledge base.

## Source Safety

- Raw sources are treated as immutable.
- Private or copyrighted source files should not be committed.
- Generated wiki pages must preserve source references.

## Validation

Before publishing or submitting:

```sh
npm run build:wiki
npm run validate
npm test
npm run loop:gaps:dry
```

## Agent Tool Contract

The agent can use:

- `list_pages`
- `search_wiki`
- `read_page`
- `answer_from_wiki`
- `validate_wiki_links`
- `wiki_health`
- `list_gaps`
- `resolve_knowledge_gap`
- `growth_log`
- `gap_research_status`

These tools must read from local wiki files and return source paths where possible.

## Scheduled Growth Loop

`npm run loop:gaps` starts a 12-hour gap research loop. The loop may resolve gaps from existing wiki evidence, queue unresolved questions in `research/queue/`, and append one-line growth events. Web research is opt-in with `ENABLE_WEB_RESEARCH=1`.
