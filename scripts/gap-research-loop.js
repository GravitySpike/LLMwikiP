const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  ROOT,
  appendGrowthLog,
  answerFromWiki,
  listKnowledgeGaps,
  readGrowthLog,
  resolveKnowledgeGap,
  searchWiki,
  validateWikiLinks,
  wikiHealth,
} = require("./wiki-core");

const RAW_DIR = path.join(ROOT, "raw");
const RESEARCH_DIR = path.join(ROOT, "research");
const QUEUE_DIR = path.join(RESEARCH_DIR, "queue");
const LAST_RUN_PATH = path.join(RESEARCH_DIR, "last-run.json");
const DEFAULT_INTERVAL_HOURS = 12;

function parseArgs(argv) {
  const args = {
    once: argv.includes("--once"),
    watch: argv.includes("--watch"),
    dryRun: argv.includes("--dry-run"),
    intervalHours: Number(process.env.GAP_RESEARCH_INTERVAL_HOURS || DEFAULT_INTERVAL_HOURS),
    maxGaps: Number(process.env.GAP_RESEARCH_MAX_GAPS || 5),
    web: process.env.ENABLE_WEB_RESEARCH === "1" || argv.includes("--web"),
  };

  const intervalIndex = argv.indexOf("--interval-hours");
  if (intervalIndex !== -1 && argv[intervalIndex + 1]) {
    args.intervalHours = Number(argv[intervalIndex + 1]);
  }

  const maxIndex = argv.indexOf("--max-gaps");
  if (maxIndex !== -1 && argv[maxIndex + 1]) {
    args.maxGaps = Number(argv[maxIndex + 1]);
  }

  if (!args.once && !args.watch) args.once = true;
  if (!Number.isFinite(args.intervalHours) || args.intervalHours <= 0) args.intervalHours = DEFAULT_INTERVAL_HOURS;
  if (!Number.isFinite(args.maxGaps) || args.maxGaps <= 0) args.maxGaps = 5;
  return args;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(input) {
  return (
    String(input || "research-note")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "research-note"
  );
}

function oneLine(value, maxLength = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function queueResearchPlan(gap, reason) {
  ensureDir(QUEUE_DIR);
  const filePath = path.join(QUEUE_DIR, `${gap.slug}.md`);
  if (fs.existsSync(filePath)) return filePath;

  const content = `# Research Queue - ${gap.question}

## Gap

${gap.question}

## Why It Was Queued

${reason}

## Suggested Intake

- Find one trustworthy source that answers the gap.
- Save the extracted note or source summary into \`raw/\`.
- Run \`npm run build:wiki\`.
- Re-run \`npm run loop:gaps:once\` so the gap can be resolved.
`;

  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

async function searchWeb(question) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(question)}&format=json&no_redirect=1&no_html=1`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "agentic-wiki-lab/1.0 local gap research loop",
    },
  });
  if (!response.ok) throw new Error(`Web search failed with HTTP ${response.status}`);

  const data = await response.json();
  const related = [];
  for (const item of data.RelatedTopics || []) {
    if (item.Text && item.FirstURL) related.push({ text: item.Text, url: item.FirstURL });
    for (const nested of item.Topics || []) {
      if (nested.Text && nested.FirstURL) related.push({ text: nested.Text, url: nested.FirstURL });
    }
  }

  return {
    heading: data.Heading || question,
    abstract: data.AbstractText || "",
    abstractUrl: data.AbstractURL || "",
    related: related.slice(0, 5),
  };
}

function hasResearchResult(result) {
  return Boolean(result.abstract || result.related.length);
}

function writeRawResearchNote(gap, result) {
  ensureDir(RAW_DIR);
  const filePath = path.join(RAW_DIR, `research-${gap.slug}.md`);
  if (fs.existsSync(filePath)) return filePath;

  const sources = [
    result.abstractUrl ? `- ${result.abstractUrl}` : null,
    ...result.related.map((item) => `- ${item.url}`),
  ].filter(Boolean);

  const related = result.related.map((item) => `- ${item.text}\n  Source: ${item.url}`).join("\n");
  const content = `# Research Note - ${gap.question}

Retrieved: ${new Date().toISOString()}

## Gap Question

${gap.question}

## Search Summary

${result.abstract || "No instant abstract was available. Related search snippets are recorded below."}

## Related Results

${related || "- No related snippets were returned."}

## Sources

${sources.length ? sources.join("\n") : "- DuckDuckGo Instant Answer API"}
`;

  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function rebuildWiki() {
  const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "build-llm-wiki.js")], {
    cwd: ROOT,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`Wiki rebuild failed:\n${result.stderr || result.stdout}`);
  }
}

function tryResolveFromCurrentWiki(gap, dryRun) {
  const hits = searchWiki(gap.question, 5);
  if (!hits.length) return null;

  if (dryRun) {
    return { dryRun: true, hitCount: hits.length, path: gap.path };
  }

  const answer = answerFromWiki(gap.question, 5);
  if (answer.resolvedGap) return answer.resolvedGap;
  return null;
}

async function processGap(gap, options) {
  const action = {
    gap: gap.path,
    question: gap.question,
    status: "open",
    note: "",
  };

  const resolved = tryResolveFromCurrentWiki(gap, options.dryRun);
  if (resolved && !resolved.dryRun) {
    action.status = "resolved";
    action.note = `Resolved from existing wiki evidence: ${resolved.path}`;
    return action;
  }
  if (resolved && resolved.dryRun) {
    action.status = "would-check-existing-evidence";
    action.note = `Current wiki has ${resolved.hitCount} candidate pages.`;
    return action;
  }

  if (!options.web) {
    if (!options.dryRun) {
      const queued = queueResearchPlan(gap, "Web research is disabled for this run.");
      appendGrowthLog(`queued-research: ${oneLine(gap.question)} -> ${path.relative(ROOT, queued).replace(/\\/g, "/")}`);
    }
    action.status = options.dryRun ? "would-queue-research" : "queued-research";
    action.note = "Enable web intake with ENABLE_WEB_RESEARCH=1 or --web.";
    return action;
  }

  const result = await searchWeb(gap.question);
  if (!hasResearchResult(result)) {
    if (!options.dryRun) {
      const queued = queueResearchPlan(gap, "Web search returned no useful instant-answer text.");
      appendGrowthLog(`queued-research: ${oneLine(gap.question)} -> ${path.relative(ROOT, queued).replace(/\\/g, "/")}`);
    }
    action.status = "search-empty";
    action.note = "No usable web summary was returned.";
    return action;
  }

  if (options.dryRun) {
    action.status = "would-add-research";
    action.note = oneLine(result.abstract || result.related[0].text);
    return action;
  }

  const rawPath = writeRawResearchNote(gap, result);
  appendGrowthLog(`research-added: ${oneLine(gap.question)} -> ${path.relative(ROOT, rawPath).replace(/\\/g, "/")}`);
  rebuildWiki();

  const answer = answerFromWiki(gap.question, 5);
  if (answer.resolvedGap) {
    action.status = "resolved";
    action.note = `Added ${path.relative(ROOT, rawPath).replace(/\\/g, "/")} and resolved ${answer.resolvedGap.path}`;
    return action;
  }

  resolveKnowledgeGap(gap.slug, {
    reason: `Research note added at ${path.relative(ROOT, rawPath).replace(/\\/g, "/")}. Review source quality before relying on the answer.`,
  });
  action.status = "resolved-with-review-needed";
  action.note = `Added ${path.relative(ROOT, rawPath).replace(/\\/g, "/")}.`;
  return action;
}

async function runCycle(options) {
  ensureDir(RESEARCH_DIR);
  const startedAt = new Date().toISOString();
  const gaps = listKnowledgeGaps().slice(0, options.maxGaps);
  const actions = [];

  for (const gap of gaps) {
    actions.push(await processGap(gap, options));
  }

  const validation = validateWikiLinks();
  const health = wikiHealth();
  const growth = readGrowthLog(5);
  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    webResearch: options.web,
    intervalHours: options.intervalHours,
    checkedGapCount: gaps.length,
    openGapCount: health.gapCount,
    resolvedGapCount: health.resolvedGapCount,
    growthEventCount: growth.total,
    validationOk: validation.ok,
    actions,
  };

  if (!options.dryRun) writeJson(LAST_RUN_PATH, summary);
  return summary;
}

function printSummary(summary) {
  console.log(`Gap research loop ${summary.dryRun ? "dry run" : "cycle"} complete.`);
  console.log(`Checked gaps: ${summary.checkedGapCount}`);
  console.log(`Open gaps: ${summary.openGapCount}`);
  console.log(`Resolved gaps: ${summary.resolvedGapCount}`);
  console.log(`Growth events: ${summary.growthEventCount}`);
  console.log(`Validation: ${summary.validationOk ? "OK" : "FAILED"}`);
  for (const action of summary.actions) {
    console.log(`- ${action.status}: ${action.question}`);
    if (action.note) console.log(`  ${action.note}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runAndPrint = async () => printSummary(await runCycle(options));

  await runAndPrint();
  if (!options.watch) return;

  const delayMs = options.intervalHours * 60 * 60 * 1000;
  console.log(`Watching for gap research every ${options.intervalHours} hours.`);
  setInterval(() => {
    runAndPrint().catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
  }, delayMs);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  runCycle,
};
