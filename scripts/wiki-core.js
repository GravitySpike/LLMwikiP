const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const WIKI_DIR = path.join(ROOT, "wiki");
const GAPS_DIR = path.join(WIKI_DIR, "gaps");
const GROWTH_LOG_PATH = path.join(WIKI_DIR, "growth-log.md");
const STOPWORDS = new Set(["a", "an", "and", "are", "as", "from", "how", "is", "of", "or", "the", "to", "what", "why"]);

function slugFromFile(filePath) {
  return path.basename(filePath, ".md");
}

function slugify(input) {
  return (
    String(input || "knowledge-gap")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "knowledge-gap"
  );
}

function walkMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkMarkdown(fullPath));
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(fullPath);
  }

  return files;
}

function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) return { data: {}, body: content };
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return { data: {}, body: content };

  const raw = content.slice(4, end).trim();
  const body = content.slice(end + 5).trimStart();
  const data = {};
  let currentKey = null;

  for (const line of raw.split("\n")) {
    if (/^\s+-\s+/.test(line) && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(line.replace(/^\s+-\s+/, "").replace(/^"|"$/g, ""));
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    currentKey = match[1];
    const value = match[2].trim();
    data[currentKey] = value === "" ? [] : value.replace(/^"|"$/g, "");
  }

  return { data, body };
}

function extractTitle(body, fallback) {
  const heading = body.match(/^#\s+(.+)$/m);
  return heading ? heading[1].trim() : fallback;
}

function loadPages() {
  return walkMarkdown(WIKI_DIR).map((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const { data, body } = parseFrontmatter(content);
    const relativePath = path.relative(ROOT, filePath).replace(/\\/g, "/");
    const slug = slugFromFile(filePath);
    const section = relativePath.split("/")[1] || "root";

    return {
      slug,
      id: `${section}/${slug}`,
      title: data.title || extractTitle(body, slug),
      type: data.type || section,
      section,
      path: relativePath,
      absolutePath: filePath,
      frontmatter: data,
      body,
      content,
    };
  });
}

function listPages() {
  return loadPages()
    .map(({ id, title, type, section, path: pagePath }) => ({ id, title, type, section, path: pagePath }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function normalizeQuery(query) {
  return String(query || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeQuery(query) {
  return String(query || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 1 && !STOPWORDS.has(term))
    .filter(Boolean);
}

function scorePage(page, terms) {
  const title = page.title.toLowerCase();
  const body = page.body.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (title.includes(term)) score += 8;
    if (page.slug.includes(term)) score += 5;
    const matches = body.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
    if (matches) score += Math.min(matches.length, 8);
  }

  return score;
}

function searchWiki(query, limit = 8) {
  const terms = normalizeQuery(query);
  if (!terms.length) return listPages().slice(0, limit);

  return loadPages()
    .map((page) => ({ page, score: scorePage(page, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title))
    .slice(0, limit)
    .map(({ page, score }) => ({
      id: page.id,
      title: page.title,
      type: page.type,
      section: page.section,
      path: page.path,
      score,
      excerpt: makeExcerpt(page.body, terms),
    }));
}

function hasEnoughEvidence(hits, terms) {
  if (!hits.length) return false;
  if (!terms.length) return true;

  const best = hits[0];
  if (best.score >= 12 && terms.length <= 2) return true;

  const searchable = `${best.title} ${best.excerpt}`.toLowerCase();
  const matchedTerms = terms.filter((term) => searchable.includes(term));
  return matchedTerms.length >= Math.min(2, terms.length) && best.score >= 8;
}

function makeExcerpt(body, terms) {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("---"));
  const hit = lines.find((line) => terms.some((term) => line.toLowerCase().includes(term))) || lines[0] || "";
  return hit.length > 220 ? `${hit.slice(0, 217)}...` : hit;
}

function readPage(idOrSlug) {
  const pages = loadPages();
  const key = String(idOrSlug || "").toLowerCase();
  const page = pages.find(
    (item) =>
      item.id.toLowerCase() === key ||
      item.slug.toLowerCase() === key ||
      item.title.toLowerCase() === key ||
      item.path.toLowerCase() === key,
  );

  if (!page) {
    const error = new Error(`Wiki page not found: ${idOrSlug}`);
    error.code = "PAGE_NOT_FOUND";
    throw error;
  }

  return page;
}

function answerFromWiki(question, limit = 5) {
  const hits = searchWiki(question, limit);
  const terms = normalizeQuery(question);
  if (!hasEnoughEvidence(hits, terms)) {
    const gap = createKnowledgeGap(question, {
      reason: "The wiki did not contain enough matching evidence to answer confidently.",
      matchedPages: hits.slice(0, 3),
    });
    return {
      answer:
        `The current wiki does not contain enough evidence for this question.\n\nKnowledge Gap created: ${gap.path}\n\nNext step: add a source to raw/ that explains this topic, then run npm run build:wiki and npm run validate.`,
      sources: [],
      gap,
    };
  }

  const resolvedGap = resolveMatchingGap(question, hits);
  const sourcePages = hits.map((hit) => readPage(hit.id));
  const answerLines = [
    `Question: ${question}`,
    "",
    "Wiki-grounded answer:",
    ...sourcePages.map((page, index) => {
      const excerpt = makeExcerpt(page.body, normalizeQuery(question));
      return `${index + 1}. ${page.title}: ${excerpt}`;
    }),
    "",
    "Use the cited wiki pages for details before making edits.",
  ];

  return {
    answer: answerLines.join("\n"),
    sources: hits.map(({ title, path: pagePath, type }) => ({ title, path: pagePath, type })),
    resolvedGap,
  };
}

function createKnowledgeGap(question, details = {}) {
  fs.mkdirSync(GAPS_DIR, { recursive: true });
  ensureGrowthLog();

  const baseSlug = slugify(question);
  let slug = baseSlug;
  let counter = 2;
  while (fs.existsSync(path.join(GAPS_DIR, `${slug}.md`))) {
    const existing = readGapFile(slug);
    if (existing && existing.question.toLowerCase() === String(question).toLowerCase()) return existing;
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  const now = new Date().toISOString();
  const matchedPages = details.matchedPages || [];
  const content = `---
type: gap
title: "Knowledge Gap - ${question.replace(/"/g, '\\"')}"
status: "open"
created_at: "${now}"
question: "${question.replace(/"/g, '\\"')}"
---

# Knowledge Gap - ${question}

## Question

${question}

## Why This Gap Exists

${details.reason || "The current wiki does not contain enough source-grounded evidence to answer this question."}

## Closest Existing Pages

${matchedPages.length ? matchedPages.map((page) => `- ${page.title} (${page.path})`).join("\n") : "- No close pages found."}

## Suggested Source Intake

- Add a Markdown, text, or PDF source to \`raw/\` that defines the missing topic.
- Run \`npm run build:wiki\`.
- Run \`npm run validate\`.
- Re-ask the question and close this gap when the answer has source coverage.

## Status

Open
`;

  fs.writeFileSync(path.join(GAPS_DIR, `${slug}.md`), content, "utf8");
  const gap = readGapFile(slug);
  appendGrowthLog(`gap: ${summarizeOneLine(question)} -> ${gap.path}`);
  return gap;
}

function summarizeOneLine(value, maxLength = 96) {
  const summary = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[|`]/g, "");
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 3)}...` : summary;
}

function ensureGrowthLog() {
  fs.mkdirSync(WIKI_DIR, { recursive: true });
  if (fs.existsSync(GROWTH_LOG_PATH)) return;
  const content = `# Growth Log

This append-only log records one-line summaries whenever the wiki discovers a new knowledge gap or growth event.

| Time | Event |
|---|---|
`;
  fs.writeFileSync(GROWTH_LOG_PATH, content, "utf8");
}

function appendGrowthLog(event) {
  ensureGrowthLog();
  const line = `| ${new Date().toISOString()} | ${event.replace(/\|/g, "/")} |\n`;
  fs.appendFileSync(GROWTH_LOG_PATH, line, "utf8");
}

function readGrowthLog(limit = 20) {
  ensureGrowthLog();
  const content = fs.readFileSync(GROWTH_LOG_PATH, "utf8");
  const entries = content
    .split("\n")
    .filter((line) => line.startsWith("| 20"))
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      return { time: parts[1], event: parts[2] };
    })
    .reverse();
  return {
    path: path.relative(ROOT, GROWTH_LOG_PATH).replace(/\\/g, "/"),
    total: entries.length,
    entries: entries.slice(0, limit),
  };
}

function readGapFile(slug) {
  const filePath = path.join(GAPS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf8");
  const { data, body } = parseFrontmatter(content);
  return {
    id: `gaps/${slug}`,
    slug,
    title: data.title || extractTitle(body, slug),
    question: data.question || "",
    status: data.status || "open",
    resolvedAt: data.resolved_at || null,
    createdAt: data.created_at || null,
    path: path.relative(ROOT, filePath).replace(/\\/g, "/"),
    content,
  };
}

function listKnowledgeGaps(options = {}) {
  const includeResolved = Boolean(options.includeResolved);
  if (!fs.existsSync(GAPS_DIR)) return [];
  return fs
    .readdirSync(GAPS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => readGapFile(path.basename(file, ".md")))
    .filter(Boolean)
    .filter((gap) => includeResolved || gap.status !== "resolved")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function resolveKnowledgeGap(idOrSlug, details = {}) {
  const slug = slugify(String(idOrSlug || "").replace(/^gaps\//, "").replace(/\.md$/, ""));
  const gap = readGapFile(slug);
  if (!gap) {
    const error = new Error(`Knowledge gap not found: ${idOrSlug}`);
    error.code = "GAP_NOT_FOUND";
    throw error;
  }
  if (gap.status === "resolved") return gap;

  const resolvedAt = new Date().toISOString();
  let content = gap.content
    .replace(/^status:\s*".*?"$/m, 'status: "resolved"')
    .replace(/^status:\s*.*$/m, 'status: "resolved"');

  if (/^resolved_at:/m.test(content)) {
    content = content.replace(/^resolved_at:\s*.*$/m, `resolved_at: "${resolvedAt}"`);
  } else {
    content = content.replace(/^created_at:.*$/m, (line) => `${line}\nresolved_at: "${resolvedAt}"`);
  }

  content = content.replace(/## Status\n\n[\s\S]*$/m, `## Status\n\nResolved\n\n## Resolution\n\n${details.reason || "The wiki now contains enough evidence to answer this question."}\n`);
  fs.writeFileSync(path.join(GAPS_DIR, `${gap.slug}.md`), content, "utf8");
  const resolved = readGapFile(gap.slug);
  appendGrowthLog(`resolved: ${summarizeOneLine(resolved.question)} -> ${resolved.path}`);
  return resolved;
}

function resolveMatchingGap(question, hits = []) {
  const normalized = String(question || "").toLowerCase();
  const gap = listKnowledgeGaps().find((item) => item.question.toLowerCase() === normalized);
  if (!gap) return null;
  const sourceList = hits.slice(0, 3).map((hit) => `${hit.title} (${hit.path})`).join(", ");
  return resolveKnowledgeGap(gap.slug, {
    reason: `Resolved automatically because answer_from_wiki found enough evidence. Supporting pages: ${sourceList || "none"}.`,
  });
}

function validateWikiLinks() {
  const pages = loadPages();
  const titles = new Set(pages.map((page) => page.title.toLowerCase()));
  const slugs = new Set(pages.map((page) => page.slug.toLowerCase()));
  const broken = [];

  for (const page of pages) {
    const links = [...page.body.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => match[1].split("|")[0].trim());
    for (const link of links) {
      const normalized = link.toLowerCase();
      if (!titles.has(normalized) && !slugs.has(normalized)) {
        broken.push({ from: page.path, link });
      }
    }
  }

  return {
    ok: broken.length === 0,
    pageCount: pages.length,
    brokenLinks: broken,
  };
}

function wikiHealth() {
  const pages = loadPages();
  const validation = validateWikiLinks();
  const maintenancePaths = new Set(["wiki/growth-log.md", "wiki/log.md", "wiki/schema.md", "wiki/health-report.md"]);
  const byType = pages.reduce((counts, page) => {
    counts[page.type] = (counts[page.type] || 0) + 1;
    return counts;
  }, {});
  const incoming = new Map(pages.map((page) => [page.title.toLowerCase(), 0]));
  const slugToTitle = new Map(pages.map((page) => [page.slug.toLowerCase(), page.title.toLowerCase()]));

  for (const page of pages) {
    const links = [...page.body.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => match[1].split("|")[0].trim());
    for (const link of links) {
      const normalized = link.toLowerCase();
      const title = incoming.has(normalized) ? normalized : slugToTitle.get(normalized);
      if (title && incoming.has(title)) incoming.set(title, incoming.get(title) + 1);
    }
  }

  const orphanPages = pages
    .filter((page) => page.type !== "overview" && page.path !== "wiki/index.md")
    .filter((page) => page.type !== "gap")
    .filter((page) => !maintenancePaths.has(page.path))
    .filter((page) => (incoming.get(page.title.toLowerCase()) || 0) === 0)
    .map((page) => ({ title: page.title, path: page.path, type: page.type }));

  const sourcePages = pages.filter((page) => page.type === "source");
  const conceptPages = pages.filter((page) => page.type === "concept");
  const gapPages = pages.filter((page) => page.type === "gap");
  const openGapPages = gapPages.filter((page) => page.frontmatter.status !== "resolved");
  const resolvedGapPages = gapPages.filter((page) => page.frontmatter.status === "resolved");
  const growthLog = readGrowthLog(1);
  const sourceCoverage = conceptPages.map((page) => {
    const sources = Array.isArray(page.frontmatter.sources) ? page.frontmatter.sources : [];
    return {
      title: page.title,
      path: page.path,
      sourceCount: sources.filter((source) => source && source !== "none").length,
    };
  });
  const uncoveredConcepts = sourceCoverage.filter((item) => item.sourceCount === 0);
  const generatedTimes = pages
    .map((page) => page.frontmatter.generated_at)
    .filter(Boolean)
    .sort();

  const scoreParts = [
    validation.ok,
    orphanPages.length === 0,
    uncoveredConcepts.length === 0,
    sourcePages.length > 0,
    conceptPages.length > 0,
  ];
  const score = Math.round((scoreParts.filter(Boolean).length / scoreParts.length) * 100);

  return {
    ok: validation.ok && uncoveredConcepts.length === 0,
    score,
    generatedAt: generatedTimes.at(-1) || null,
    pageCount: pages.length,
    sourceCount: sourcePages.length,
    conceptCount: conceptPages.length,
    gapCount: openGapPages.length,
    resolvedGapCount: resolvedGapPages.length,
    growthEventCount: growthLog.total,
    synthesisCount: pages.filter((page) => page.type === "synthesis").length,
    brokenLinkCount: validation.brokenLinks.length,
    orphanPageCount: orphanPages.length,
    uncoveredConceptCount: uncoveredConcepts.length,
    byType,
    brokenLinks: validation.brokenLinks,
    orphanPages,
    uncoveredConcepts,
    recommendations: [
      validation.brokenLinks.length ? "Fix broken wiki links before publishing." : null,
      orphanPages.length ? "Add links from index, overview, or related concepts to orphan pages." : null,
      uncoveredConcepts.length ? "Attach at least one source to each concept page." : null,
      sourcePages.length ? null : "Add at least one raw source and rebuild the wiki.",
    ].filter(Boolean),
  };
}

module.exports = {
  ROOT,
  WIKI_DIR,
  appendGrowthLog,
  answerFromWiki,
  createKnowledgeGap,
  listKnowledgeGaps,
  listPages,
  loadPages,
  readGrowthLog,
  readPage,
  resolveKnowledgeGap,
  searchWiki,
  validateWikiLinks,
  wikiHealth,
};
