# Wiki Schema

## Layers

- `raw/`: user-provided source material.
- `wiki/`: generated Markdown wiki pages.
- `.llm-wiki/`: local cache and manifest.
- `schema/`: rules that describe how wiki pages should be maintained.
- `tools/`: MCP-facing tools.
- `app/`: visual wiki viewer.

## Page Types

- `source`: generated from one raw source file.
- `concept`: stable reusable idea.
- `synthesis`: cross-source explanation or roadmap.
- `overview`: map of the current wiki.

## Required Metadata

Generated pages should include:

- `type`
- `title`
- `source_file` for source pages
- `generated_at`
- `concepts` or `sources` when applicable

## Link Rule

Use double-bracket wiki links for internal references. Run validation before publishing.

## Agent Rule

Agents must answer from local wiki evidence first. If no source supports an answer, the agent should ask for a new raw source instead of inventing content.
