const fs = require("node:fs");
const path = require("node:path");
const { listPages, readPage, validateWikiLinks } = require("./wiki-core");

const root = path.resolve(__dirname, "..");
const submissionDir = path.join(root, "submission");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copy(source, target) {
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stripFrontmatter(content) {
  return content.replace(/^---[\s\S]*?---\n/, "");
}

function renderMarkdown(content) {
  const lines = stripFrontmatter(content).split("\n");
  const html = [];
  let listMode = null;

  function closeList() {
    if (listMode) {
      html.push(`</${listMode}>`);
      listMode = null;
    }
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }

    const inline = escapeHtml(line)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[\[([^\]]+)\]\]/g, "<a>$1</a>");

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      html.push(`<h${heading[1].length}>${inline.replace(/^#+\s+/, "")}</h${heading[1].length}>`);
      continue;
    }

    const bullet = line.match(/^-\s+(.+)$/);
    if (bullet) {
      if (listMode !== "ul") {
        closeList();
        listMode = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${inline.replace(/^-\s+/, "")}</li>`);
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      if (listMode !== "ol") {
        closeList();
        listMode = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${inline.replace(/^\d+\.\s+/, "")}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inline}</p>`);
  }

  closeList();
  return html.join("\n");
}

function buildPreview() {
  const pages = listPages();
  const validation = validateWikiLinks();
  const active = readPage("concepts/harness-engineering");
  const concepts = pages.filter((page) => page.section === "concepts").slice(0, 20);
  const sources = pages.filter((page) => page.section === "sources").slice(0, 8);

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>Agentic Coding LLM Wiki MVP</title>
<style>
:root{color-scheme:dark;--bg:#0f1117;--panel:#171a22;--panel2:#202432;--line:#2b3140;--text:#eceff4;--muted:#98a2b3;--accent:#7db1ff;--ok:#5ee1a2}
*{box-sizing:border-box}body{margin:0;width:1600px;height:960px;display:grid;grid-template-columns:330px 1fr 430px;background:var(--bg);color:var(--text);font-family:Inter,Segoe UI,system-ui,sans-serif}.sidebar,.agent{background:var(--panel);border-right:1px solid var(--line);overflow:hidden}.agent{border-left:1px solid var(--line);border-right:0;display:grid;grid-template-rows:auto 1fr auto}.brand{padding:18px 16px;border-bottom:1px solid var(--line)}h1{margin:0;font-size:24px}.brand p,.muted{color:var(--muted);margin:4px 0 0}.search{padding:12px}.search div{height:40px;border:1px solid var(--line);border-radius:6px;background:#0d1017;color:var(--muted);padding:9px 12px}.label{margin:14px 16px 6px;color:var(--muted);font-size:12px;text-transform:uppercase}.page{display:flex;align-items:center;gap:9px;margin:2px 8px;padding:8px;border-radius:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.page.active{background:#263148}.dot{width:9px;height:9px;border-radius:50%;background:var(--accent);flex:0 0 auto}.reader{overflow:hidden}.toolbar{height:62px;display:flex;align-items:center;padding:14px 40px;border-bottom:1px solid var(--line)}.pill{padding:4px 10px;border-radius:999px;background:var(--panel2);color:#c7d2fe}.markdown{padding:24px 48px 60px;max-width:940px}.markdown h1{font-size:36px;padding-bottom:12px;border-bottom:1px solid var(--line)}.markdown h2{font-size:24px;margin-top:30px}.markdown p,.markdown li{font-size:18px;line-height:1.65}.markdown a{color:var(--accent);text-decoration:underline}.markdown code{background:#11151f;border:1px solid var(--line);border-radius:5px;padding:2px 6px}.agent-header{height:58px;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line)}.agent-header strong{font-size:18px}.agent-header span{display:block;color:var(--muted);font-size:13px}.reset{background:#31405f;border-radius:6px;padding:8px 12px}.chat{padding:16px}.msg{margin-bottom:14px;padding:12px 14px;border-radius:8px;background:var(--panel2);font-size:17px;line-height:1.55;white-space:pre-wrap}.msg.user{margin-left:60px;background:#2b3f67}.sources{margin-top:10px;color:var(--muted);font-size:13px}.chatbar{display:grid;grid-template-columns:1fr auto;gap:8px;padding:12px;border-top:1px solid var(--line)}.input{height:40px;border:1px solid var(--line);border-radius:6px;background:#0d1017;color:var(--muted);padding:9px 12px}.send{border-radius:6px;background:#5797f2;color:white;padding:9px 16px}
</style>
</head>
<body>
<aside class="sidebar">
  <div class="brand"><h1>LLM Wiki</h1><p>${pages.length} pages · <span style="color:var(--ok)">${validation.ok ? "validate OK" : "needs review"}</span> · MCP tools</p></div>
  <div class="search"><div>Search: harness, MCP, agent...</div></div>
  <div class="label">Concepts</div>
  ${concepts
    .map((page) => `<div class="page ${page.id === active.id ? "active" : ""}"><span class="dot"></span>${escapeHtml(page.title)}</div>`)
    .join("")}
  <div class="label">Sources</div>
  ${sources.map((page) => `<div class="page"><span class="dot"></span>${escapeHtml(page.title)}</div>`).join("")}
</aside>
<main class="reader">
  <div class="toolbar"><span class="pill">${escapeHtml(active.type)}</span><span class="muted">&nbsp;${escapeHtml(active.path)}</span></div>
  <article class="markdown">${renderMarkdown(active.content)}</article>
</main>
<aside class="agent">
  <div class="agent-header"><div><strong>Wiki Agent</strong><span>subagent over MCP-style tools</span></div><div class="reset">Reset</div></div>
  <div class="chat">
    <div class="msg">MCP-style tools ready: list_pages, search_wiki, read_page, answer_from_wiki, validate_wiki_links.</div>
    <div class="msg user">바이브 코딩과 에이전트 코딩과 하네스 엔지니어링은 어떻게 달라?</div>
    <div class="msg">Wiki-grounded answer:
1. Vibe Coding: exploratory human + LLM coding.
2. Agent Coding: agents plan, use tools, edit, and verify.
3. Harness Engineering: runtime wrapper, instructions, tools, checks, and feedback loops that make agents safe and repeatable.
<div class="sources">Sources: Harness Engineering, Vibe Coding, Agent Coding</div></div>
  </div>
  <div class="chatbar"><div class="input">질문/검증/수정 요청...</div><div class="send">Send</div></div>
</aside>
</body>
</html>`;
}

ensureDir(submissionDir);
copy(path.join(root, "docs/DOMAIN.md"), path.join(submissionDir, "DOMAIN.md"));
copy(path.join(root, "docs/JOURNAL.md"), path.join(submissionDir, "JOURNAL.md"));
copy(path.join(root, "docs/PRD_AGENT_SPEC.md"), path.join(submissionDir, "PRD_AGENT_SPEC.md"));
copy(path.join(root, "README.md"), path.join(submissionDir, "README.md"));
fs.writeFileSync(path.join(submissionDir, "mvp-preview.html"), buildPreview(), "utf8");

console.log(`Submission files prepared in ${submissionDir}`);
