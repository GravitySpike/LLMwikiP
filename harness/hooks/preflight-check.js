#!/usr/bin/env node
const { validateWikiLinks, wikiHealth } = require("../../scripts/wiki-core");

const result = validateWikiLinks();
const health = wikiHealth();

if (!result.ok) {
  console.error("Wiki link validation failed:");
  console.error(JSON.stringify(result.brokenLinks, null, 2));
  process.exit(1);
}

console.log(`Wiki validation OK: ${result.pageCount} pages, 0 broken links.`);
console.log(`Wiki health score: ${health.score}/100 (${health.sourceCount} sources, ${health.conceptCount} concepts).`);
