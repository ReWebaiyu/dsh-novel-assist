/**
 * Build the single-file Client artifact from the per-panel sources.
 *
 * The Harness Client loader accepts one plain-JS bundle per plugin, so the
 * browser artifact stays `client.js`; this script concatenates the readable
 * source chunks (same factory scope) into that artifact.
 *
 * Usage:
 *   node src/build-client.mjs
 *
 * Run it after editing anything under src/client/. The generated client.js is
 * what the browser loads; src/client/*.js is the source of truth for review.
 */
import { readFile, writeFile } from 'node:fs/promises'

const here = new URL('./', import.meta.url)
const parts = ['client/00-boot.js', 'client/10-skills.js', 'client/20-rank.js', 'client/30-work.js']
const chunks = []
for (const part of parts) {
  chunks.push(await readFile(new URL(part, here), 'utf8'))
}
const output = chunks.join('\n')
await writeFile(new URL('../client.js', here), output, 'utf8')
console.log('built client.js', output.length, 'bytes from', parts.length, 'parts')
