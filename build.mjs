import { build } from 'esbuild'
import { mkdir, copyFile, writeFile } from 'node:fs/promises'
import { ornament } from './art.mjs'

await mkdir('dist/assets/art', { recursive: true })
await Promise.all([
  copyFile('public/style.css', 'dist/assets/style.css'),
  copyFile('public/hero.jpg', 'dist/assets/hero.jpg'),
  ...[0, 1, 2, 3].map(index =>
    writeFile('dist/assets/art/' + index + '.svg', ornament(index)),
  ),
])

const shared = {
  bundle: true,
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
}

await build({
  ...shared,
  entryPoints: ['client.jsx'],
  outfile: 'dist/assets/shop.js',
})

await build({
  ...shared,
  entryPoints: ['server.mjs'],
  platform: 'browser',
  conditions: ['workerd', 'worker', 'browser'],
  format: 'esm',
  loader: { '.html': 'text' },
  outfile: 'dist/worker.js',
})
