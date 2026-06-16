#!/usr/bin/env node
const { validateWikiLinks } = require("../../scripts/wiki-core");

const result = validateWikiLinks();

if (!result.ok) {
  console.error("Wiki link validation failed:");
  console.error(JSON.stringify(result.brokenLinks, null, 2));
  process.exit(1);
}

console.log(`Wiki validation OK: ${result.pageCount} pages, 0 broken links.`);
