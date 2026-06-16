const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const WIKI_DIR = path.join(ROOT, "wiki");

function slugFromFile(filePath) {
  return path.basename(filePath, ".md");
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
  if (!hits.length) {
    return {
      answer:
        "The current wiki does not contain enough evidence for this question. Add a source or use web research before updating the wiki.",
      sources: [],
    };
  }

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
  };
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
  const maintenancePaths = new Set(["wiki/log.md", "wiki/schema.md", "wiki/health-report.md"]);
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
    .filter((page) => !maintenancePaths.has(page.path))
    .filter((page) => (incoming.get(page.title.toLowerCase()) || 0) === 0)
    .map((page) => ({ title: page.title, path: page.path, type: page.type }));

  const sourcePages = pages.filter((page) => page.type === "source");
  const conceptPages = pages.filter((page) => page.type === "concept");
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
  answerFromWiki,
  listPages,
  loadPages,
  readPage,
  searchWiki,
  validateWikiLinks,
  wikiHealth,
};
