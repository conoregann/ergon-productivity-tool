import { build } from 'vite'
import { readFile, readdir } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

// Same Vite defaults, React version and compression for both builds.
for (const baseline of [true, false]) {
  const outDir = baseline ? 'dist-baseline' : 'dist'
  await build({
    logLevel: 'error',
    build: { outDir },
    plugins: baseline
      ? [
          {
            name: 'react-only-baseline',
            load(id) {
              if (id.endsWith('/main.jsx'))
                return `
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          createRoot(document.getElementById('root')).render(<h1>Calendar spike</h1>);
        `
            },
          },
        ]
      : [],
  })
  const sizes = { javascript: { raw: 0, gzip: 0 }, css: { raw: 0, gzip: 0 } }
  for (const name of await readdir(`${outDir}/assets`)) {
    const kind = name.endsWith('.js')
      ? 'javascript'
      : name.endsWith('.css')
        ? 'css'
        : null
    if (!kind) continue
    const bytes = await readFile(`${outDir}/assets/${name}`)
    sizes[kind].raw += bytes.length
    sizes[kind].gzip += gzipSync(bytes).length
  }
  console.log(
    JSON.stringify({
      build: baseline ? 'react-only' : 'calendar-fixture',
      bytes: sizes,
    }),
  )
}
