const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { PDFParse } = require("pdf-parse");

const root = process.cwd();
const rawDir = fs.existsSync(path.join(root, "raw")) ? path.join(root, "raw") : path.join(root, "Raw");
const wikiDir = path.join(root, "wiki");
const metaDir = path.join(root, ".llm-wiki");
const extractedDir = path.join(metaDir, "extracted");
const now = new Date().toISOString();
const checkOnly = process.argv.includes("--check");

const CONCEPTS = [
  {
    slug: "requirements-framing",
    title: "Requirements Framing",
    patterns: [/requirements?/i, /verification/i, /specification/i, /acceptance criteria/i],
    description: "Analysis work that frames user goals, system scope, constraints, requirements, and verifiable specifications.",
  },
  {
    slug: "vibe-coding",
    title: "Vibe Coding",
    patterns: [/vibe coding/i, /prototype/i, /rapid implementation/i],
    description: "An exploratory development style where a human and an LLM quickly turn ideas into working code.",
  },
  {
    slug: "agent-coding",
    title: "Agent Coding",
    patterns: [/agent coding/i, /\bagents?\b/i, /agentic/i],
    description: "A development workflow where LLM agents plan, use tools, edit code, and verify results in repeated cycles.",
  },
  {
    slug: "sdlc-pipeline",
    title: "SDLC Pipeline",
    patterns: [/sdlc/i, /pipeline/i, /software development life cycle/i],
    description: "The software lifecycle flow across analysis, design, implementation, testing, deployment, and maintenance.",
  },
  {
    slug: "subprocess-calling",
    title: "Subprocess Calling",
    patterns: [/subprocess/i, /calling/i, /process/i, /shell/i, /terminal/i],
    description: "The mechanism by which an agent invokes external commands, scripts, shells, or child processes.",
  },
  {
    slug: "plan-mode",
    title: "Plan Mode",
    patterns: [/plan[_ -]?mode/i, /sequential/i, /parallel/i, /planning/i],
    description: "An agent operating mode that decomposes work into steps and chooses sequential or parallel execution.",
  },
  {
    slug: "agent-specifications",
    title: "Agent Specifications",
    patterns: [/specifications?/i, /instructions?/i, /role/i, /policy/i, /rules/i],
    description: "Documents that define an agent's role, inputs, outputs, permissions, constraints, and operating rules.",
  },
  {
    slug: "agent-pool-orchestrator",
    title: "Agent Pool and Orchestrator",
    patterns: [/agent pool/i, /orchestrator/i, /orchestration/i, /coordination/i],
    description: "A coordination structure for allocating, scheduling, and integrating work across multiple agents.",
  },
  {
    slug: "harness-and-skills",
    title: "Harness and Skills",
    patterns: [/harness/i, /\bskills?\b/i, /tool/i, /test environment/i],
    description: "Execution support and reusable capabilities that let agents use tools and procedures reliably.",
  },
  {
    slug: "harness-engineering",
    title: "Harness Engineering",
    patterns: [/harness/i, /execute wrapper/i, /AGENTS\.md/i, /CLAUDE\.md/i, /PROFILE\.md/i],
    description: "The engineering discipline of building the runtime wrapper, instructions, tools, checks, and feedback loops that let AI agents work safely and repeatably.",
  },
  {
    slug: "model-context-protocol",
    title: "Model Context Protocol",
    patterns: [/model context protocol/i, /\bmcp\b/i, /context protocol/i],
    description: "A standardized context protocol for connecting LLM applications to external tools and data sources.",
  },
  {
    slug: "loop-and-hooks",
    title: "Loop and Hooks",
    patterns: [/\bloop\b/i, /\bhooks?\b/i, /iteration/i, /feedback/i],
    description: "Agent execution loops and hook-based extension points that run behavior at specific moments.",
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content.replace(/\r\n/g, "\n"), "utf8");
}

function resetGeneratedWiki() {
  for (const name of ["sources", "concepts", "synthesis"]) {
    fs.rmSync(path.join(wikiDir, name), { recursive: true, force: true });
  }

  for (const name of ["index.md", "log.md", "overview.md", "schema.md"]) {
    fs.rmSync(path.join(wikiDir, name), { force: true });
  }
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function titleFromFileName(fileName) {
  return fileName.replace(/^\d+\.\s*/, "").replace(/\.(pdf|md|markdown|txt)$/i, "");
}

function cleanText(text) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isReadableLine(line) {
  const compact = line.trim();
  if (!compact) return false;
  const asciiChars = compact.match(/[\x20-\x7E]/g) || [];
  const questionMarks = compact.match(/\?/g) || [];
  const asciiRatio = asciiChars.length / compact.length;
  const questionRatio = questionMarks.length / compact.length;
  return asciiRatio >= 0.65 && questionRatio <= 0.12;
}

function displayLine(line) {
  return line.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
}

function splitPages(text) {
  const marker = /\n--\s*(\d+)\s+of\s+(\d+)\s+--\n/g;
  const pages = [];
  let lastIndex = 0;
  let match;

  while ((match = marker.exec(text)) !== null) {
    const pageText = text.slice(lastIndex, match.index).trim();
    if (pageText) pages.push(pageText);
    lastIndex = marker.lastIndex;
  }

  const tail = text.slice(lastIndex).trim();
  if (tail) pages.push(tail);
  return pages.length ? pages : [text];
}

function getLines(text) {
  return cleanText(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^--\s*\d+\s+of\s+\d+\s*--$/.test(line))
    .filter(isReadableLine)
    .map(displayLine)
    .filter(Boolean);
}

function pickTitle(fileName, lines) {
  return titleFromFileName(fileName);
}

function extractHighlights(lines) {
  const seen = new Set();
  const highlights = [];

  for (const line of lines) {
    const normalized = line.replace(/^[-•]\s*/, "").trim();
    const looksUseful =
      /^[-•]/.test(line) ||
      /^[A-Z][A-Z0-9 /&:_-]{4,}$/.test(normalized) ||
      /(purpose|requirement|verify|verification|design|implementation|analysis|management|agent|coding|pipeline|protocol|hook|skill|orchestrator)/i.test(normalized);

    if (looksUseful && normalized.length >= 8 && normalized.length <= 180 && !seen.has(normalized)) {
      seen.add(normalized);
      highlights.push(normalized);
    }

    if (highlights.length >= 12) break;
  }

  return highlights;
}

function extractHeadings(lines) {
  const headings = [];
  const seen = new Set();

  for (const line of lines) {
    const normalized = line.replace(/^[-•]\s*/, "").trim();
    const isHeading =
      normalized.length >= 4 &&
      normalized.length <= 70 &&
      !/[.!?]$/.test(normalized) &&
      (/^[A-Z][A-Z0-9 /&:_-]{3,}$/.test(normalized) ||
        /^(The |What |Why |How |Plan|Agent|Model|System|Loop|Hook|Skill|Harness|SDLC|MCP)/i.test(normalized));

    if (isHeading && !seen.has(normalized)) {
      seen.add(normalized);
      headings.push(normalized);
    }

    if (headings.length >= 10) break;
  }

  return headings;
}

function summarizeSource(source) {
  const titleFromFile = source.fileName.replace(/^\d+\.\s*/, "").replace(/\.pdf$/i, "");
  const topHeadings = source.headings.slice(0, 5);
  const topConcepts = source.concepts.map((concept) => `[[${concept.title}]]`);
  const bullets = source.highlights.slice(0, 7);

  return [
    `This source focuses on **${titleFromFile}**.`,
    topConcepts.length ? `Detected concept links: ${topConcepts.join(", ")}.` : "Few concept links were detected automatically.",
    topHeadings.length ? `Early visible sections include ${topHeadings.join(", ")}.` : "Few clear section headings were extracted from the PDF text.",
    bullets.length ? `Notable extracted cues include ${bullets.slice(0, 3).join("; ")}.` : "A future LLM ingest pass should create a richer summary.",
  ].join(" ");
}

async function parsePdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo().catch(() => ({}));
    const result = await parser.getText();
    return {
      text: cleanText(result.text || ""),
      pages: info.total || result.total || undefined,
    };
  } finally {
    await parser.destroy();
  }
}

function parseTextSource(filePath) {
  const text = cleanText(fs.readFileSync(filePath, "utf8"));
  return { text, pages: 1 };
}

function detectConcepts(text) {
  return CONCEPTS.filter((concept) => concept.patterns.some((pattern) => pattern.test(text)));
}

function buildSourceMarkdown(source) {
  return `---
type: source
title: "${source.title.replace(/"/g, '\\"')}"
source_file: "../raw/${source.fileName}"
pages: ${source.pages || source.pageChunks.length}
sha256: "${source.hash}"
generated_at: "${now}"
concepts:
${source.concepts.map((concept) => `  - "[[${concept.title}]]"`).join("\n") || "  - none"}
---

# ${source.title}

## Summary

${source.summary}

## Source Facts

- Raw file: \`raw/${source.fileName}\`
- Extracted pages: ${source.pages || source.pageChunks.length}
- Text characters: ${source.text.length.toLocaleString("en-US")}
- SHA256: \`${source.hash}\`

## Detected Structure

${source.headings.length ? source.headings.map((heading) => `- ${heading}`).join("\n") : "- No clear headings detected."}

## Key Extracted Notes

${source.highlights.length ? source.highlights.map((line) => `- ${line}`).join("\n") : "- No high-confidence notes were extracted automatically."}

## Related Concepts

${source.concepts.length ? source.concepts.map((concept) => `- [[${concept.title}]]`).join("\n") : "- No concept page linked yet."}

## Follow-up Questions

- Which claims from this source should be promoted into stable concept pages?
- Are there contradictions with earlier sources?
- What examples or diagrams should be preserved as separate assets?
`;
}

function buildConceptMarkdown(concept, sources) {
  const matchedSources = sources.filter((source) => source.concepts.some((item) => item.slug === concept.slug));
  const evidence = matchedSources.flatMap((source) =>
    source.highlights.slice(0, 3).map((line) => ({ source, line })),
  );

  return `---
type: concept
title: "${concept.title}"
generated_at: "${now}"
sources:
${matchedSources.map((source) => `  - "[[${source.title}]]"`).join("\n") || "  - none"}
---

# ${concept.title}

## Working Definition

${concept.description}

## Source Coverage

${matchedSources.length ? matchedSources.map((source) => `- [[${source.title}]]`).join("\n") : "- No source has been linked yet."}

## Evidence Notes

${evidence.length ? evidence.map((item) => `- From [[${item.source.title}]]: ${item.line}`).join("\n") : "- Add evidence after the next ingest pass."}

## Open Questions

- What should become the canonical explanation for this concept?
- Which examples from the raw sources best illustrate it?
- Does any newer source supersede or refine this page?
`;
}

function buildIndex(sources, concepts) {
  return `# LLM Wiki Index

Generated at: ${now}

## Entry Points

- [[Overview]]
- [[Learning Path]]
- [[Implementation Roadmap]]

## Sources

${sources.map((source) => `- [[${source.title}]] - ${source.fileName}`).join("\n")}

## Concepts

${concepts.map((concept) => `- [[${concept.title}]] - ${concept.description}`).join("\n")}

## Maintenance

- Run \`npm run build:wiki\` after adding or changing files in \`Raw/\`.
- Read \`wiki/log.md\` to see generated operations.
- Use \`wiki/schema.md\` as the instruction contract for future LLM-assisted ingest.
`;
}

function buildOverview(sources, concepts) {
  const sourceList = sources.map((source) => `- [[${source.title}]]: ${source.summary}`).join("\n");
  const conceptList = concepts
    .map((concept) => {
      const count = sources.filter((source) => source.concepts.some((item) => item.slug === concept.slug)).length;
      return `- [[${concept.title}]] (${count} source${count === 1 ? "" : "s"}): ${concept.description}`;
    })
    .join("\n");

  return `---
type: overview
generated_at: "${now}"
---

# Overview

This wiki is generated from the PDF files in \`Raw/\`. It is a local MVP of the LLM Wiki pattern: raw sources remain untouched, generated Markdown pages live under \`wiki/\`, and future LLM passes can refine these pages while preserving source traceability.

## Source Map

${sourceList}

## Concept Map

${conceptList}

## Current Thesis

The source set appears to describe an agentic coding workflow: it starts from requirements framing and LLM-assisted specification, then moves through vibe coding, SDLC alignment, subprocess/tool use, planning modes, agent specifications, orchestration, harness/skills, MCP, and execution loops/hooks.
`;
}

function buildLearningPath(sources, concepts) {
  const conceptTitles = new Set(concepts.map((concept) => concept.title));
  const link = (title) => (conceptTitles.has(title) ? `[[${title}]]` : title);

  return `---
type: synthesis
title: "Learning Path"
generated_at: "${now}"
sources:
${sources.map((source) => `  - "[[${source.title}]]"`).join("\n")}
---

# Learning Path

1. Start with ${link("Vibe Coding")} to explore a working idea quickly.
2. Move into ${link("Agent Coding")} so the agent can plan, edit, run tools, and verify results.
3. Add ${link("Harness Engineering")} to make the agent workflow safe and repeatable.
4. Connect tools through ${link("Model Context Protocol")} or a local MCP-style server.
5. Reuse procedures through ${link("Harness and Skills")} and project rules.
6. Stabilize behavior with ${link("Loop and Hooks")}, linting, review points, and repeatable feedback cycles.

## Source Order

${sources.map((source, index) => `${index + 1}. [[${source.title}]]`).join("\n")}
`;
}

function buildRoadmap() {
  return `---
type: synthesis
title: "Implementation Roadmap"
generated_at: "${now}"
---

# Implementation Roadmap

## MVP

- Keep raw PDFs immutable in \`Raw/\`.
- Extract text into \`.llm-wiki/extracted/\` for repeatable ingest.
- Generate source pages under \`wiki/sources/\`.
- Generate concept pages under \`wiki/concepts/\`.
- Maintain \`wiki/index.md\`, \`wiki/log.md\`, and \`wiki/overview.md\`.

## Next Iteration

- Replace heuristic summaries with an LLM analysis step.
- Add a review queue before concept pages are overwritten.
- Store page-level citations and PDF page references.
- Add full-text search over generated Markdown and extracted source text.
- Add lint checks for broken links, orphan pages, stale claims, and source fidelity.
`;
}

function buildSchema() {
  return `# LLM Wiki Schema

This file defines how the wiki should be maintained.

## Layers

- \`Raw/\`: immutable source files. Do not edit generated knowledge back into this folder.
- \`wiki/\`: generated Markdown knowledge base.
- \`.llm-wiki/\`: local caches and machine-readable metadata.

## Page Types

- \`source\`: one page per raw file, stored in \`wiki/sources/\`.
- \`concept\`: stable topic pages, stored in \`wiki/concepts/\`.
- \`synthesis\`: cross-source analysis, stored in \`wiki/synthesis/\`.
- \`overview\`: global map of the wiki.

## Ingest Rules

- Preserve source traceability in YAML frontmatter.
- Use double-bracket wiki links for internal references.
- Prefer updating existing concept pages over creating duplicate pages.
- Add unresolved ambiguity to an Open Questions section.
- Append every run to \`wiki/log.md\`.

## Future LLM Pass

When an LLM is connected, use a two-step ingest:

1. Analyze each source into structured observations, entities, concepts, contradictions, and candidate updates.
2. Generate or update Markdown pages from the structured analysis, then run lint checks before accepting changes.
`;
}

function buildPurpose() {
  return `# Purpose

This wiki exists to turn the raw Agentic Coding Basics PDFs into a persistent, browsable Markdown knowledge base.

## Goals

- Build a durable reference for agentic coding concepts.
- Preserve links from generated notes back to raw source files.
- Make future LLM-assisted refinement safe and repeatable.
- Support learning paths, implementation planning, and concept review.

## Current Scope

- Source corpus: files in \`raw/\`.
- Output format: Markdown files with YAML frontmatter and double-bracket wiki links.
- MVP summarization: local text extraction plus deterministic heuristics.
`;
}

function buildLog(sources) {
  const entries = sources
    .map((source) => `## [${now.slice(0, 10)}] ingest | ${source.title}

- Raw source: \`Raw/${source.fileName}\`
- Generated page: \`wiki/sources/${source.slug}.md\`
- Linked concepts: ${source.concepts.map((concept) => `[[${concept.title}]]`).join(", ") || "none"}
- Hash: \`${source.hash}\`
`)
    .join("\n");

  return `# Log

${entries}
## [${now.slice(0, 10)}] build | Wiki MVP

- Regenerated source, concept, overview, index, and synthesis pages.
- Generator: \`scripts/build-llm-wiki.js\`
`;
}

async function main() {
  if (!fs.existsSync(rawDir)) {
    throw new Error(`raw directory not found: ${rawDir}`);
  }

  const sourceFiles = fs
    .readdirSync(rawDir)
    .filter((file) => /\.(pdf|md|markdown|txt)$/i.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (!sourceFiles.length) {
    throw new Error("No source files found in raw/. Add a PDF, Markdown, or text file.");
  }

  ensureDir(wikiDir);
  ensureDir(extractedDir);
  if (!checkOnly) resetGeneratedWiki();

  const sources = [];

  for (const fileName of sourceFiles) {
    const filePath = path.join(rawDir, fileName);
    const { text, pages } = fileName.toLowerCase().endsWith(".pdf")
      ? await parsePdf(filePath)
      : parseTextSource(filePath);
    const lines = getLines(text);
    const hash = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
    const title = pickTitle(fileName, lines);
    const slug = slugify(fileName);
    const pageChunks = splitPages(text);
    const concepts = detectConcepts(`${fileName}\n${text}`);
    const headings = extractHeadings(lines);
    const highlights = extractHighlights(lines);

    const source = {
      fileName,
      filePath,
      slug,
      title,
      text,
      pages,
      pageChunks,
      hash,
      concepts,
      headings,
      highlights,
    };
    source.summary = summarizeSource(source);
    sources.push(source);

    if (!checkOnly) {
      writeFile(path.join(extractedDir, `${slug}.txt`), text);
      writeFile(path.join(wikiDir, "sources", `${slug}.md`), buildSourceMarkdown(source));
    }
  }

  const usedConcepts = CONCEPTS.filter((concept) =>
    sources.some((source) => source.concepts.some((item) => item.slug === concept.slug)),
  );

  if (!checkOnly) {
    writeFile(path.join(root, "purpose.md"), buildPurpose());
    writeFile(path.join(wikiDir, "schema.md"), buildSchema());
    writeFile(path.join(wikiDir, "overview.md"), buildOverview(sources, usedConcepts));
    writeFile(path.join(wikiDir, "index.md"), buildIndex(sources, usedConcepts));
    writeFile(path.join(wikiDir, "log.md"), buildLog(sources));
    writeFile(path.join(wikiDir, "synthesis", "learning-path.md"), buildLearningPath(sources, usedConcepts));
    writeFile(path.join(wikiDir, "synthesis", "implementation-roadmap.md"), buildRoadmap());

    for (const concept of usedConcepts) {
      writeFile(path.join(wikiDir, "concepts", `${concept.slug}.md`), buildConceptMarkdown(concept, sources));
    }

    writeFile(
      path.join(metaDir, "manifest.json"),
      `${JSON.stringify(
        {
          generatedAt: now,
    rawDir: "raw",
          wikiDir: "wiki",
          sources: sources.map((source) => ({
            fileName: source.fileName,
            slug: source.slug,
            title: source.title,
            pages: source.pages || source.pageChunks.length,
            sha256: source.hash,
            concepts: source.concepts.map((concept) => concept.slug),
          })),
        },
        null,
        2,
      )}\n`,
    );
  }

  console.log(`Processed ${sources.length} raw source(s).`);
  console.log(`Detected ${usedConcepts.length} concept page(s).`);
  if (!checkOnly) console.log(`Generated wiki at ${wikiDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
