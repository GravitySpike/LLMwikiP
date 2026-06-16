# Agentic Wiki Lab

Agentic Wiki Lab is a runnable local product that combines:

- a **harness** for agent operating rules,
- an **LLM Wiki** generator and Markdown knowledge base,
- **MCP-style tools** for agent access,
- and a browser **visualization viewer**.

Clone the repository, add one source file, run two commands, and you can view your own local wiki.

## What This Builds

```text
raw source file
  -> wiki generator
  -> Markdown wiki pages
  -> MCP tools
  -> browser viewer + wiki agent panel
```

The repository already includes a small demo source in `raw/agentic-coding-demo.md`, so it works immediately after install.

## 30-Minute Quick Start

### 1. Install

Requirements:

- Node.js 24 or later
- npm

```sh
npm install
```

### 2. Add One Source

Put a file into `raw/`.

Supported MVP formats:

- `.md`
- `.txt`
- `.pdf`

Example:

```text
raw/my-first-source.md
```

### 3. Build the Wiki

```sh
npm run build:wiki
```

Generated pages appear in:

```text
wiki/
```

### 4. Validate

```sh
npm run validate
```

This checks internal wiki links before you rely on the viewer or tools.

### 5. Open the Viewer

```sh
npm run app
```

Open:

```text
http://localhost:3000
```

You should see:

- page list and search on the left,
- rendered wiki page in the center,
- wiki agent panel on the right.

## Harness

Harness files define how an agent should operate in this repository.

- `AGENTS.md`: agent role, allowed actions, restrictions, and workflow
- `RULES.md`: repository rules and validation contract
- `harness/skills/wiki-curator/SKILL.md`: reusable wiki curation skill
- `harness/hooks/preflight-check.js`: validation hook used by `npm run validate`

The harness keeps agent work repeatable:

```text
inspect raw -> build wiki -> validate links -> view -> answer with sources
```

## LLM Wiki

Important folders:

- `raw/`: source materials
- `wiki/`: generated wiki pages
- `schema/`: wiki schema and page rules
- `.llm-wiki/`: local manifest and extraction cache

Generated wiki pages include:

- `wiki/sources/`: one generated page per raw source
- `wiki/concepts/`: concept pages
- `wiki/synthesis/`: cross-source summaries
- `wiki/index.md`
- `wiki/overview.md`
- `wiki/log.md`

## MCP Tool Server

Run:

```sh
npm run mcp
```

The MCP-style server uses newline-delimited JSON-RPC over stdio.

Tool entry point:

```text
tools/wiki-mcp-server.js
```

Available tools:

- `list_pages`: list wiki page ids, titles, types, sections, and paths
- `search_wiki`: search wiki pages by keyword and return ranked excerpts
- `read_page`: read one wiki page by id, slug, title, or path
- `answer_from_wiki`: answer a question using retrieved wiki pages
- `validate_wiki_links`: check internal double-bracket wiki links
- `wiki_health`: report page counts, broken links, orphan pages, source coverage, score, and recommendations
- `list_gaps`: list open knowledge gaps created by weak or missing wiki evidence
- `create_knowledge_gap`: create a gap backlog item for a missing topic
- `resolve_knowledge_gap`: mark a gap as resolved so it no longer counts as open
- `growth_log`: read recent one-line growth events

Example JSON-RPC message:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

Example tool call:

```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_wiki","arguments":{"query":"harness","limit":3}}}
```

## Viewer API

The browser viewer uses the same wiki core as the MCP server.

Local endpoints:

- `GET /api/pages`
- `GET /api/page?id=concepts/harness-engineering`
- `GET /api/search?q=harness`
- `POST /api/answer`
- `GET /api/validate`
- `GET /api/health`
- `GET /api/gaps`
- `POST /api/gaps`
- `POST /api/gaps/resolve`
- `GET /api/growth-log`

## Wiki Health Dashboard

The viewer includes a Wiki Health card that makes the project more than a static wiki viewer.

It reports:

- health score
- source count
- concept count
- broken link count
- orphan page count

The same information is available to agents through the `wiki_health` MCP tool and to humans through `wiki/health-report.md`.

## Knowledge Gap Tracker

The viewer and MCP tools now include a lightweight growth loop.

When `answer_from_wiki` cannot find enough evidence, it does not silently fail. It creates a Markdown backlog item in:

```text
wiki/gaps/
```

That gap records:

- the unanswered question
- why the wiki could not answer it
- the closest existing pages
- what source material should be added next

This makes the wiki behave less like a static file browser and more like a growing knowledge system.

Every new gap also appends a one-line growth event to:

```text
wiki/growth-log.md
```

The log is intentionally commit-like:

```text
gap: How does agent memory differ from session memory? -> wiki/gaps/...
```

When a gap is resolved, the file remains as historical evidence but its frontmatter changes to `status: "resolved"`.
Resolved gaps are not counted in the Health card's open `Gaps` value. Resolution also appends a `resolved:` line to `wiki/growth-log.md`.

Typical loop:

```text
ask question
  -> wiki lacks evidence
  -> gap file is created
  -> one-line growth log is appended
  -> add source to raw/
  -> rebuild wiki
  -> validate
  -> re-ask and close the gap
```

## Material Input to Integration Flow

When you add new material:

1. Put the source into `raw/`.
2. Run `npm run build:wiki`.
3. Run `npm run validate`.
4. Start `npm run app`.
5. Ask the wiki agent a question in the viewer.
6. If the answer is weak, the system creates a knowledge gap in `wiki/gaps/`.
7. Add a better raw source or concept pattern, rebuild, and re-ask.

## Demo Image

The `demo/` folder contains a screenshot of the real wiki rendered in the viewer style:

```text
demo/wiki-viewer.png
```

Regenerate it with:

```sh
npm run demo:png
```

## Verification Commands

```sh
npm run build:wiki
npm run validate
npm test
```

Expected:

- raw sources are processed,
- link validation reports OK,
- the viewer starts with `npm run app`.

## Publishing Notes

This repository is intended to be public. Private raw files should stay out of git.

Ignored by default:

- `raw/_private/`
- `raw/*.pdf`
- `Agentic_Coding_Basics.zip`
- generated submission zips
- `node_modules/`
