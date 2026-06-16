# PRD and Agent Specification

## Product Name

Agentic Coding LLM Wiki

## Goal

Build an MCP-enabled wiki tool that serves Markdown wiki pages generated from raw source PDFs and allows an AI agent or user interface to search, read, validate, and answer from the wiki.

## Problem

Raw PDFs are difficult for an AI agent to use directly. They are large, repetitive, and not structured for incremental retrieval. The project needs a bridge between raw knowledge and agent workflows.

## Users

- Student learning agentic coding workflows
- Developer building an AI-assisted coding system
- AI agent that needs reliable local knowledge

## MVP Features

### Wiki Generation

- Read source PDFs from `Raw/`
- Generate Markdown pages under `wiki/`
- Preserve source metadata and SHA256 hash
- Maintain an index, overview, log, concept pages, and synthesis pages

### MCP Tools

The MCP server exposes:

- `list_pages`: list all wiki pages
- `search_wiki`: search wiki pages by keyword
- `read_page`: read a page by id, slug, title, or path
- `answer_from_wiki`: generate a source-grounded answer from retrieved wiki pages
- `validate_wiki_links`: check broken wiki links

### GUI

- Left sidebar: page list and search
- Center panel: rendered Markdown page
- Right panel: wiki-grounded agent chat
- Validation status indicator
- Source display for agent answers

## Non-Goals

- No cloud deployment in the MVP
- No external LLM API key requirement
- No automatic overwrite of human-reviewed wiki pages
- No database dependency

## Agent Role

The Wiki Agent helps the user navigate and query the local LLM Wiki.

## Agent Permissions

Allowed:

- List wiki pages
- Search wiki pages
- Read wiki pages
- Answer using wiki evidence
- Validate internal links

Not allowed in MVP:

- Delete raw files
- Rewrite raw source files
- Publish data externally
- Automatically edit wiki pages without review

## Agent Operating Rules

1. Use local wiki pages before external information.
2. Cite source wiki pages when answering.
3. If the wiki does not contain enough information, say so.
4. Keep raw sources immutable.
5. Prefer proposed edits over direct edits for future versions.

## Acceptance Criteria

- `npm run build:wiki` processes all raw PDFs.
- `npm run mcp` starts a JSON-RPC MCP-style server.
- `npm run app` starts the local GUI.
- GUI lists wiki pages and renders Markdown.
- Wiki Agent answers a question using local wiki pages.
- Link validation reports the current wiki status.
- Submission package contains four Markdown documents and one PNG image.
