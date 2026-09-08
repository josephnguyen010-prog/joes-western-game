# Rebuild index.html from the sources in src/.
# The three JS files are one IIFE split for readability, so they are
# concatenated rather than loaded as separate <script> tags.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$parts = @(
  (Get-Content src/head.html    -Raw),
  (Get-Content src/00-shell.html -Raw),
  '<script>',
  (Get-Content src/01-world.js  -Raw),
  (Get-Content src/02-actors.js -Raw),
  (Get-Content src/03-game.js   -Raw),
  '</script>',
  '</body>',
  '</html>'
)
[System.IO.File]::WriteAllText("$PSScriptRoot\index.html", ($parts -join "`n"))
Write-Output "built index.html ($((Get-Item index.html).Length) bytes)"
