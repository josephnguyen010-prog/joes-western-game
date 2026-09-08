#!/usr/bin/env bash
# Rebuild index.html from the sources in src/.
# The three JS files are one IIFE split for readability, so they are
# concatenated rather than loaded as separate <script> tags.
set -e
cd "$(dirname "$0")"
{
  cat src/head.html
  cat src/00-shell.html
  echo '<script>'
  cat src/01-world.js src/02-actors.js src/03-game.js
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
