import {build} from 'esbuild'
await build({entryPoints:['client.jsx'],bundle:true,minify:true,outfile:'public/shop.js',define:{'process.env.NODE_ENV':'"production"'}})
await build({entryPoints:['render.jsx'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'build/render.mjs'})
