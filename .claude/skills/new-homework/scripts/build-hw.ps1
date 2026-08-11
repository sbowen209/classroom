# .claude/skills/new-homework/scripts/build-hw.ps1
#
# Build a homework packet (student + teacher copies), then rasterise every page
# so you can actually look at it. Reports errors, overfull boxes, page count,
# and a per-page density figure that finds half-empty pages at a glance.
#
#   pwsh .claude/skills/new-homework/scripts/build-hw.ps1 hw01
#   pwsh .claude/skills/new-homework/scripts/build-hw.ps1 hw01 -SkipTeacher
#
# PNGs land in <packet>/.preview/. Read them with the Read tool.

param(
  [Parameter(Mandatory = $true)][string]$Packet,
  [switch]$SkipTeacher,
  [int]$Dpi = 100
)

$ErrorActionPreference = 'Stop'

# MiKTeX installs per-user and is not on PATH in a fresh shell.
$miktex = "$env:LOCALAPPDATA\Programs\MiKTeX\miktex\bin\x64"
if (Test-Path $miktex) { $env:PATH = "$miktex;$env:PATH" }
if (-not (Get-Command pdflatex -ErrorAction SilentlyContinue)) {
  throw "pdflatex not found. Install MiKTeX: winget install --id MiKTeX.MiKTeX --scope user"
}

# scripts -> new-homework -> skills -> .claude -> repo root
$repo = $PSScriptRoot
1..4 | ForEach-Object { $repo = Split-Path -Parent $repo }
$dir  = Join-Path $repo "homework\$Packet"
if (-not (Test-Path (Join-Path $dir "$Packet.tex"))) {
  throw "No such packet: homework\$Packet\$Packet.tex"
}
Set-Location $dir

function Invoke-Latex([string[]]$LatexArgs, [string]$Label) {
  # Twice: the second pass settles TikZ bounding boxes and page refs.
  # Do NOT add "2>&1" here. In Windows PowerShell 5.1 that wraps each stderr
  # line from a native exe in an ErrorRecord, and MiKTeX's harmless "you have
  # not checked for updates" nag then aborts the script.
  1..2 | ForEach-Object { & pdflatex @LatexArgs | Out-Null }
  $log = "$Label.log"
  $errors   = @(Select-String -Path $log -Pattern '^!' -Context 0, 3)
  $overfull = @(Select-String -Path $log -Pattern 'Overfull \\hbox')
  $pages    = @(Select-String -Path $log -Pattern 'Output written on')

  # Everything reported here goes through Write-Host on purpose. Anything
  # written to the output stream inside a PowerShell function becomes part of
  # its return value, and the caller's [bool] test then sees a non-empty array
  # and reports a clean build as a failure.
  Write-Host "`n=== $Label ===" -ForegroundColor Cyan
  if ($errors.Count)   { Write-Host 'ERRORS:'   -ForegroundColor Red;    $errors   | ForEach-Object { Write-Host $_.Line } }
  if ($overfull.Count) { Write-Host 'OVERFULL:' -ForegroundColor Yellow; $overfull | ForEach-Object { Write-Host $_.Line } }
  if (-not $errors.Count -and -not $overfull.Count) { Write-Host 'clean' -ForegroundColor Green }
  $pages | ForEach-Object { Write-Host ($_.Line.Trim()) }
  return [bool]$errors.Count
}

$failed = Invoke-Latex @('-interaction=nonstopmode', "$Packet.tex") $Packet
if (-not $SkipTeacher) {
  Invoke-Latex @('-interaction=nonstopmode', "-jobname=$Packet-teacher",
                 "\def\TEACHER{}\input{$Packet.tex}") "$Packet-teacher" | Out-Null
}
if ($failed) { throw "Student copy failed to build. Fix the errors above before looking at pages." }

# -- Rasterise, so the pages can be looked at rather than guessed about ------
$preview = Join-Path $dir '.preview'
if (Test-Path $preview) { Get-ChildItem "$preview\*.png" | Remove-Item }
else { New-Item -ItemType Directory -Path $preview | Out-Null }

& pdftoppm -png -r $Dpi "$Packet.pdf" (Join-Path $preview 'p')

Write-Host "`n=== page density (bytes of PNG; a small number is a half-empty page) ===" -ForegroundColor Cyan
$pngs = Get-ChildItem "$preview\p-*.png" | Sort-Object Name
$max  = ($pngs | Measure-Object -Property Length -Maximum).Maximum
foreach ($p in $pngs) {
  $bar = '#' * [math]::Round(40 * $p.Length / $max)
  $flag = if ($p.Length -lt 0.45 * $max) { '  <-- look at this one' } else { '' }
  '{0,-10} {1,8}  {2}{3}' -f $p.Name, $p.Length, $bar, $flag
}

Write-Host "`nPNGs in $preview - now READ them. The log does not show a bad page." -ForegroundColor Yellow

# Aux files are noise in git; the PDFs and .tex are what matter.
Get-ChildItem *.aux, *.out -ErrorAction SilentlyContinue | Remove-Item
