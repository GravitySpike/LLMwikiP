param(
  [string]$OutputPath = "submission/mvp.png"
)

$pageCount = 0
$healthScore = 0
$sourceCount = 0
$conceptCount = 0
$gapCount = 0
$eventCount = 0
try {
  $healthJson = (node -e "const wiki=require('./scripts/wiki-core'); process.stdout.write(JSON.stringify(wiki.wikiHealth()))")
  $health = $healthJson | ConvertFrom-Json
  $pageCount = $health.pageCount
  $healthScore = $health.score
  $sourceCount = $health.sourceCount
  $conceptCount = $health.conceptCount
  $gapCount = [string]$health.gapCount
  $eventCount = $health.growthEventCount
} catch {
  $pageCount = 0
}
if ([string]::IsNullOrWhiteSpace($gapCount)) { $gapCount = "0" }

Add-Type -AssemblyName System.Drawing

$width = 1600
$height = 960
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$bg = [System.Drawing.Color]::FromArgb(15, 17, 23)
$panel = [System.Drawing.Color]::FromArgb(23, 26, 34)
$panel2 = [System.Drawing.Color]::FromArgb(32, 36, 50)
$line = [System.Drawing.Color]::FromArgb(43, 49, 64)
$text = [System.Drawing.Color]::FromArgb(236, 239, 244)
$muted = [System.Drawing.Color]::FromArgb(152, 162, 179)
$accent = [System.Drawing.Color]::FromArgb(125, 177, 255)
$ok = [System.Drawing.Color]::FromArgb(94, 225, 162)
$user = [System.Drawing.Color]::FromArgb(43, 63, 103)

$fontTitle = New-Object System.Drawing.Font("Segoe UI", 24, [System.Drawing.FontStyle]::Bold)
$fontH1 = New-Object System.Drawing.Font("Segoe UI", 28, [System.Drawing.FontStyle]::Bold)
$fontH2 = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$fontBody = New-Object System.Drawing.Font("Segoe UI", 14)
$fontSmall = New-Object System.Drawing.Font("Segoe UI", 10)
$fontBold = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)

function Brush($color) { New-Object System.Drawing.SolidBrush($color) }
function Pen($color, $size = 1) { New-Object System.Drawing.Pen($color, $size) }

function DrawText($value, $font, $color, $x, $y, $w, $h) {
  $format = New-Object System.Drawing.StringFormat
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $format.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit
  $graphics.DrawString($value, $font, (Brush $color), (New-Object System.Drawing.RectangleF($x, $y, $w, $h)), $format)
}

function FillRoundRect($x, $y, $w, $h, $radius, $color) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $radius * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $graphics.FillPath((Brush $color), $path)
  $path.Dispose()
}

$graphics.Clear($bg)

# Layout panels
$graphics.FillRectangle((Brush $panel), 0, 0, 330, $height)
$graphics.FillRectangle((Brush $bg), 330, 0, 840, $height)
$graphics.FillRectangle((Brush $panel), 1170, 0, 430, $height)
$graphics.DrawLine((Pen $line), 329, 0, 329, $height)
$graphics.DrawLine((Pen $line), 1170, 0, 1170, $height)

# Sidebar
DrawText "LLM Wiki" $fontTitle $text 16 18 250 35
DrawText "$pageCount pages - validate OK - MCP tools" $fontBody $muted 16 58 280 28
$graphics.DrawLine((Pen $line), 0, 98, 330, 98)
FillRoundRect 12 118 300 40 6 ([System.Drawing.Color]::FromArgb(13, 16, 23))
DrawText "Search: harness, MCP, agent..." $fontBody $muted 24 127 260 24

FillRoundRect 12 170 300 126 8 ([System.Drawing.Color]::FromArgb(17, 23, 34))
DrawText "Wiki Health" $fontBold $text 24 184 140 24
DrawText "$healthScore/100" $fontSmall $ok 246 188 58 18
$hx = @(24, 122, 220)
$hy = @(218, 262)
DrawText "Sources" $fontSmall $muted $hx[0] $hy[0] 80 18
DrawText "$sourceCount" $fontBold $text $hx[0] ($hy[0] + 17) 80 22
DrawText "Concepts" $fontSmall $muted $hx[1] $hy[0] 80 18
DrawText "$conceptCount" $fontBold $text $hx[1] ($hy[0] + 17) 80 22
DrawText "Broken" $fontSmall $muted $hx[2] $hy[0] 80 18
DrawText "0" $fontBold $text $hx[2] ($hy[0] + 17) 80 22
DrawText "Orphans" $fontSmall $muted $hx[0] $hy[1] 80 18
DrawText "0" $fontBold $text $hx[0] ($hy[1] + 17) 80 22
DrawText "Gaps" $fontSmall $muted $hx[1] $hy[1] 80 18
DrawText "$gapCount" $fontBold $text $hx[1] ($hy[1] + 17) 80 22
DrawText "Events" $fontSmall $muted $hx[2] $hy[1] 80 18
DrawText "$eventCount" $fontBold $text $hx[2] ($hy[1] + 17) 80 22

DrawText "CONCEPTS" $fontSmall $muted 16 314 200 20
$concepts = @(
  "Agent Coding",
  "Agent Pool and Orchestrator",
  "Agent Specifications",
  "Harness and Skills",
  "Harness Engineering",
  "Loop and Hooks",
  "Model Context Protocol",
  "Plan Mode",
  "SDLC Pipeline",
  "Subprocess Calling",
  "Vibe Coding"
)
$y = 342
foreach ($item in $concepts) {
  if ($item -eq "Harness Engineering") { FillRoundRect 8 ($y - 3) 310 34 6 ([System.Drawing.Color]::FromArgb(38, 49, 72)) }
  $graphics.FillEllipse((Brush $accent), 16, ($y + 8), 9, 9)
  DrawText $item $fontBody $text 36 $y 260 26
  $y += 38
}
DrawText "SOURCES" $fontSmall $muted 16 ($y + 8) 200 20
$y += 36
$sources = @("Vibe coding and Agent coding", "SDLC pipeline in Vibe coding", "Harness and Skills", "Model Context Protocol")
foreach ($item in $sources) {
  $graphics.FillEllipse((Brush $accent), 16, ($y + 8), 9, 9)
  DrawText $item $fontBody $text 36 $y 260 26
  $y += 38
}

# Reader toolbar and page
$graphics.DrawLine((Pen $line), 330, 62, 1170, 62)
FillRoundRect 370 17 82 30 15 $panel2
DrawText "concept" $fontSmall ([System.Drawing.Color]::FromArgb(199, 210, 254)) 390 23 60 20
DrawText "wiki/concepts/harness-engineering.md" $fontBody $muted 462 22 360 25

DrawText "Harness Engineering" $fontH1 $text 370 88 620 52
$graphics.DrawLine((Pen $line), 370, 150, 1088, 150)
DrawText "Working Definition" $fontH2 $text 370 188 400 34
DrawText "The engineering discipline of building the runtime wrapper, instructions, tools, checks, and feedback loops that let AI agents work safely and repeatably." $fontBody $text 370 232 700 80
DrawText "Source Coverage" $fontH2 $text 370 335 400 34
DrawText "- Agent pool and Orchestrator`n- Harness and Skills" $fontBody $text 390 378 560 70
DrawText "Evidence Notes" $fontH2 $text 370 485 400 34
DrawText "- Limitations of Workflow (Pipeline)`n- Main Orchestrator (Sub-Agent)`n- Phase 1 Jobs To Be Done AI Agent /spec`n- Procedure to Skill`n- Preference to PROFILE.md, AGENTS.md, CLAUDE.md" $fontBody $text 390 530 680 150
DrawText "MCP Tool Flow" $fontH2 $text 370 720 400 34
DrawText "Raw PDFs -> Markdown Wiki -> wiki-core.js -> MCP Server -> Wiki Agent -> GUI answer with sources" $fontBody $text 370 765 720 40

# Agent panel
$graphics.DrawLine((Pen $line), 1170, 58, 1600, 58)
DrawText "Wiki Agent" $fontH2 $text 1190 14 180 28
DrawText "subagent over MCP-style tools" $fontSmall $muted 1190 39 220 18
FillRoundRect 1502 13 72 32 6 ([System.Drawing.Color]::FromArgb(49, 64, 95))
DrawText "Reset" $fontSmall $text 1522 21 50 18

FillRoundRect 1190 84 365 118 8 $panel2
DrawText "MCP-style tools ready:`nlist_pages, search_wiki, read_page, answer_from_wiki, validate_wiki_links." $fontBody $text 1206 100 332 86

FillRoundRect 1250 226 305 62 8 $user
DrawText "How are Vibe Coding, Agent Coding, and Harness Engineering different?" $fontBody $text 1266 242 270 44

FillRoundRect 1190 312 365 290 8 $panel2
DrawText "Wiki-grounded answer:" $fontBold $text 1206 328 320 24
DrawText "1. Vibe Coding: exploratory human + LLM coding.`n`n2. Agent Coding: agents plan, use tools, edit, and verify.`n`n3. Harness Engineering: runtime wrapper, instructions, tools, checks, and feedback loops that make agents safe and repeatable." $fontBody $text 1206 362 326 170
DrawText "Sources: Harness Engineering, Vibe Coding, Agent Coding" $fontSmall $muted 1206 555 330 24

FillRoundRect 1190 890 310 42 6 ([System.Drawing.Color]::FromArgb(13, 16, 23))
DrawText "Ask, validate, or request an edit..." $fontBody $muted 1204 899 250 24
FillRoundRect 1510 890 62 42 6 ([System.Drawing.Color]::FromArgb(87, 151, 242))
DrawText "Send" $fontBody ([System.Drawing.Color]::White) 1522 899 44 24

$outputDir = Split-Path $OutputPath -Parent
if ($outputDir -and -not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}
$resolved = Resolve-Path -Path $outputDir
$finalPath = Join-Path $resolved (Split-Path $OutputPath -Leaf)
$bitmap.Save($finalPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()

Write-Host "Created $finalPath"
