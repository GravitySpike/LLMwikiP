const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const {
  answerFromWiki,
  createKnowledgeGap,
  listKnowledgeGaps,
  listPages,
  readPage,
  searchWiki,
  validateWikiLinks,
  wikiHealth,
} = require("../scripts/wiki-core");

const PORT = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "public");

function sendJson(res, value, status = 200) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
    }[ext] || "application/octet-stream";

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": contentType });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Request body too large"));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/pages") {
      sendJson(res, listPages());
      return;
    }

    if (url.pathname === "/api/page") {
      const page = readPage(url.searchParams.get("id") || "index");
      sendJson(res, {
        id: page.id,
        title: page.title,
        type: page.type,
        section: page.section,
        path: page.path,
        content: page.content,
        body: page.body,
      });
      return;
    }

    if (url.pathname === "/api/search") {
      sendJson(res, searchWiki(url.searchParams.get("q") || "", Number(url.searchParams.get("limit") || 8)));
      return;
    }

    if (url.pathname === "/api/answer" && req.method === "POST") {
      const payload = JSON.parse((await readBody(req)) || "{}");
      sendJson(res, answerFromWiki(payload.question || "", payload.limit || 5));
      return;
    }

    if (url.pathname === "/api/validate") {
      sendJson(res, validateWikiLinks());
      return;
    }

    if (url.pathname === "/api/health") {
      sendJson(res, wikiHealth());
      return;
    }

    if (url.pathname === "/api/gaps" && req.method === "GET") {
      sendJson(res, listKnowledgeGaps());
      return;
    }

    if (url.pathname === "/api/gaps" && req.method === "POST") {
      const payload = JSON.parse((await readBody(req)) || "{}");
      sendJson(res, createKnowledgeGap(payload.question || "", { reason: payload.reason || "Created from viewer." }));
      return;
    }

    const safePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.normalize(path.join(publicDir, safePath));
    if (!filePath.startsWith(publicDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    sendFile(res, filePath);
  } catch (error) {
    sendJson(res, { error: error.message }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`LLM Wiki GUI running at http://localhost:${PORT}`);
});
