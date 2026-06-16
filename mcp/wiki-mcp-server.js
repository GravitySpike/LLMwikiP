#!/usr/bin/env node
const {
  answerFromWiki,
  createKnowledgeGap,
  listKnowledgeGaps,
  listPages,
  readGrowthLog,
  readPage,
  resolveKnowledgeGap,
  searchWiki,
  validateWikiLinks,
  wikiHealth,
} = require("../scripts/wiki-core");

const tools = [
  {
    name: "list_pages",
    description: "List generated LLM Wiki pages with id, title, type, section, and path.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "search_wiki",
    description: "Search wiki pages by keyword and return ranked excerpts.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number", default: 8 },
      },
      required: ["query"],
    },
  },
  {
    name: "read_page",
    description: "Read a wiki page by id, slug, title, or path.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "answer_from_wiki",
    description: "Create a short answer grounded in wiki pages and return sources.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
        limit: { type: "number", default: 5 },
      },
      required: ["question"],
    },
  },
  {
    name: "validate_wiki_links",
    description: "Validate wiki-style [[links]] across generated Markdown pages.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "wiki_health",
    description: "Return a quality dashboard for the current wiki, including page counts, broken links, orphan pages, coverage, and recommendations.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_gaps",
    description: "List open knowledge gaps created when the wiki lacks enough evidence to answer a question.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_knowledge_gap",
    description: "Create a knowledge gap backlog item for a question the wiki cannot answer yet.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
        reason: { type: "string" },
      },
      required: ["question"],
    },
  },
  {
    name: "growth_log",
    description: "Read recent one-line growth events recorded as the wiki discovers missing knowledge.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "resolve_knowledge_gap",
    description: "Mark an open knowledge gap as resolved so it no longer counts as an open gap.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        reason: { type: "string" },
      },
      required: ["id"],
    },
  },
];

function textResult(value) {
  return {
    content: [
      {
        type: "text",
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

async function callTool(name, args = {}) {
  if (name === "list_pages") return textResult(listPages());
  if (name === "search_wiki") return textResult(searchWiki(args.query, args.limit));
  if (name === "read_page") {
    const page = readPage(args.id);
    return textResult({ title: page.title, path: page.path, type: page.type, content: page.content });
  }
  if (name === "answer_from_wiki") return textResult(answerFromWiki(args.question, args.limit));
  if (name === "validate_wiki_links") return textResult(validateWikiLinks());
  if (name === "wiki_health") return textResult(wikiHealth());
  if (name === "list_gaps") return textResult(listKnowledgeGaps());
  if (name === "create_knowledge_gap") {
    return textResult(createKnowledgeGap(args.question, { reason: args.reason || "Created by MCP tool request." }));
  }
  if (name === "growth_log") return textResult(readGrowthLog(args.limit || 20));
  if (name === "resolve_knowledge_gap") {
    return textResult(resolveKnowledgeGap(args.id, { reason: args.reason || "Resolved by MCP tool request." }));
  }
  throw new Error(`Unknown tool: ${name}`);
}

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function respondError(id, error) {
  process.stdout.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error.message || String(error) },
    })}\n`,
  );
}

process.stdin.setEncoding("utf8");
let buffer = "";

process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (!line.trim()) continue;
    handleMessage(line);
  }
});

async function handleMessage(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    respondError(null, new Error("Invalid JSON-RPC message"));
    return;
  }

  try {
    if (message.method === "initialize") {
      respond(message.id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "agentic-coding-wiki", version: "0.1.0" },
      });
      return;
    }

    if (message.method === "tools/list") {
      respond(message.id, { tools });
      return;
    }

    if (message.method === "tools/call") {
      const result = await callTool(message.params.name, message.params.arguments || {});
      respond(message.id, result);
      return;
    }

    if (message.id !== undefined) respond(message.id, {});
  } catch (error) {
    respondError(message.id, error);
  }
}
