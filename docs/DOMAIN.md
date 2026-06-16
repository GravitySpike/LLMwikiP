# Wiki Domain Definition

## Domain

This project builds an **Agentic Coding Operations Wiki**.

The wiki is not a course-note dump. It uses local raw files as seed sources, but the target knowledge domain is the practical operation of AI-assisted software engineering workflows:

- Vibe Coding
- Agent Coding
- Harness Engineering
- Skills and reusable procedures
- MCP-based tool integration
- Agent specifications
- Agent pool and orchestration
- Loop, hooks, and automation
- SDLC alignment for AI-assisted coding

## Why This Domain

Agentic coding workflows are useful only when knowledge, tools, and agent rules are maintained together. A normal folder of lecture PDFs is hard to query and hard to update. A Markdown wiki served through MCP tools gives an AI agent a stable memory layer:

- Raw sources remain unchanged.
- Generated wiki pages become searchable and readable.
- Agents can answer from wiki evidence instead of guessing.
- Future edits can be proposed, reviewed, and validated.

## Source Boundary

The current MVP uses these raw sources:

- `Raw/1. Vibe coding and Agent coding.pdf`
- `Raw/2. SDLC pipeline in Vibe coding.pdf`
- `Raw/3. Agents subprocess calling.pdf`
- `Raw/4. Plan_mode Sequential and Parallel agents.pdf`
- `Raw/5. Agent Specifications.pdf`
- `Raw/6. Agent pool and Orchestrator.pdf`
- `Raw/7. Harness and Skills.pdf`
- `Raw/8. Model Context Protocol.pdf`
- `Raw/9. Loop and Hooks.pdf`

## Wiki Output Scope

The generated wiki contains:

- Source pages: one page per raw PDF
- Concept pages: stable pages for recurring ideas
- Synthesis pages: learning path and implementation roadmap
- Index and overview pages
- Machine-readable metadata in `.llm-wiki/manifest.json`

## Intended User

The intended user is a student or developer who wants to understand and reuse agentic coding patterns. The tool should help them:

- Search concepts quickly
- Read source-grounded explanations
- Ask a wiki-grounded agent questions
- Validate internal wiki links
- Extend the wiki with future sources
