let pages = [];
let activeId = null;

const pageList = document.querySelector("#page-list");
const markdown = document.querySelector("#markdown");
const searchInput = document.querySelector("#search-input");
const pageCount = document.querySelector("#page-count");
const validation = document.querySelector("#validation");
const healthScore = document.querySelector("#health-score");
const healthSources = document.querySelector("#health-sources");
const healthConcepts = document.querySelector("#health-concepts");
const healthBroken = document.querySelector("#health-broken");
const healthOrphans = document.querySelector("#health-orphans");
const pageType = document.querySelector("#page-type");
const pagePath = document.querySelector("#page-path");
const chatLog = document.querySelector("#chat-log");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const resetChat = document.querySelector("#reset-chat");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[\[([^\]]+)\]\]/g, '<a href="#" data-wikilink="$1">$1</a>');
}

function renderMarkdown(source) {
  const body = source.replace(/^---[\s\S]*?---\n/, "");
  const lines = body.split("\n");
  const html = [];
  let listMode = null;
  let inCode = false;
  let codeLines = [];

  function closeList() {
    if (listMode) {
      html.push(`</${listMode}>`);
      listMode = null;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (line.startsWith(">")) {
      closeList();
      html.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      if (listMode !== "ol") {
        closeList();
        listMode = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    const bullet = line.match(/^-\s+(.+)$/);
    if (bullet) {
      if (listMode !== "ul") {
        closeList();
        listMode = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  closeList();
  return html.join("\n");
}

function groupPages(items) {
  const order = ["concepts", "sources", "synthesis", "root"];
  return items.reduce((groups, page) => {
    const section = order.includes(page.section) ? page.section : "root";
    groups[section] = groups[section] || [];
    groups[section].push(page);
    return groups;
  }, {});
}

function renderPageList(items) {
  const groups = groupPages(items);
  pageList.innerHTML = "";

  for (const section of ["concepts", "sources", "synthesis", "root"]) {
    if (!groups[section]) continue;
    const label = document.createElement("div");
    label.className = "section-label";
    label.textContent = section;
    pageList.append(label);

    for (const page of groups[section]) {
      const button = document.createElement("button");
      button.className = `page-button ${page.id === activeId ? "active" : ""}`;
      button.type = "button";
      button.innerHTML = `<span class="dot"></span><span>${escapeHtml(page.title)}</span>`;
      button.addEventListener("click", () => openPage(page.id));
      pageList.append(button);
    }
  }
}

async function openPage(id) {
  const response = await fetch(`/api/page?id=${encodeURIComponent(id)}`);
  const page = await response.json();
  activeId = page.id;
  markdown.innerHTML = renderMarkdown(page.content);
  pageType.textContent = page.type;
  pagePath.textContent = page.path;
  renderPageList(filterPages(searchInput.value));
}

function filterPages(query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return pages;
  return pages.filter((page) => {
    const haystack = `${page.title} ${page.type} ${page.section} ${page.path}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

function addMessage(role, text, sources = []) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.textContent = text;
  if (sources.length) {
    const sourceBox = document.createElement("div");
    sourceBox.className = "sources";
    sourceBox.textContent = `Sources: ${sources.map((source) => source.title).join(", ")}`;
    message.append(sourceBox);
  }
  chatLog.append(message);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function ask(question) {
  addMessage("user", question);
  const response = await fetch("/api/answer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const result = await response.json();
  addMessage("agent", result.answer, result.sources || []);
}

async function boot() {
  const [pageResponse, validationResponse, healthResponse] = await Promise.all([
    fetch("/api/pages"),
    fetch("/api/validate"),
    fetch("/api/health"),
  ]);
  pages = await pageResponse.json();
  const validationResult = await validationResponse.json();
  const health = await healthResponse.json();

  pageCount.textContent = String(pages.length);
  validation.textContent = validationResult.ok ? "validate OK" : `${validationResult.brokenLinks.length} broken`;
  validation.className = validationResult.ok ? "ok" : "warn";
  healthScore.textContent = `${health.score}/100`;
  healthSources.textContent = String(health.sourceCount);
  healthConcepts.textContent = String(health.conceptCount);
  healthBroken.textContent = String(health.brokenLinkCount);
  healthOrphans.textContent = String(health.orphanPageCount);

  renderPageList(pages);
  await openPage("concepts/harness-engineering");
  addMessage(
    "agent",
    "MCP-style tools ready: list_pages, search_wiki, read_page, answer_from_wiki, validate_wiki_links.\n질문하면 현재 wiki를 기준으로 답하고 출처 페이지를 붙입니다.",
  );
}

searchInput.addEventListener("input", () => renderPageList(filterPages(searchInput.value)));

markdown.addEventListener("click", (event) => {
  const link = event.target.closest("[data-wikilink]");
  if (!link) return;
  event.preventDefault();
  const target = pages.find((page) => page.title === link.dataset.wikilink || page.slug === link.dataset.wikilink);
  if (target) openPage(target.id);
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;
  chatInput.value = "";
  ask(question);
});

resetChat.addEventListener("click", () => {
  chatLog.innerHTML = "";
  addMessage("agent", "대화를 초기화했습니다. Wiki 기반으로 다시 질문해 주세요.");
});

boot().catch((error) => {
  markdown.innerHTML = `<h1>Load error</h1><p>${escapeHtml(error.message)}</p>`;
});
