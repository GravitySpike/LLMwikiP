# LLM Wiki Schema

This file defines how the wiki should be maintained.

## Layers

- `Raw/`: immutable source files. Do not edit generated knowledge back into this folder.
- `wiki/`: generated Markdown knowledge base.
- `.llm-wiki/`: local caches and machine-readable metadata.

## Page Types

- `source`: one page per raw file, stored in `wiki/sources/`.
- `concept`: stable topic pages, stored in `wiki/concepts/`.
- `synthesis`: cross-source analysis, stored in `wiki/synthesis/`.
- `overview`: global map of the wiki.

## Ingest Rules

- Preserve source traceability in YAML frontmatter.
- Use double-bracket wiki links for internal references.
- Prefer updating existing concept pages over creating duplicate pages.
- Add unresolved ambiguity to an Open Questions section.
- Append every run to `wiki/log.md`.

## Future LLM Pass

When an LLM is connected, use a two-step ingest:

1. Analyze each source into structured observations, entities, concepts, contradictions, and candidate updates.
2. Generate or update Markdown pages from the structured analysis, then run lint checks before accepting changes.
