import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, extname, sep } from 'node:path'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' }
createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1:4173').pathname)
    if (pathname === '/Fossildle') { response.writeHead(301, { Location: '/Fossildle/' }); response.end(); return }
    if (pathname.startsWith('/Fossildle/')) pathname = pathname.slice('/Fossildle'.length)
    if (pathname.endsWith('/')) pathname += 'index.html'
    const filename = resolve(root, pathname.replace(/^\/+/, ''))
    if (!filename.startsWith(resolve(root) + sep)) { response.writeHead(403); response.end(); return }
    const body = await readFile(filename)
    response.writeHead(200, { 'Content-Type': types[extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(body)
  } catch { response.writeHead(404); response.end('Not Found') }
}).listen(4173, '127.0.0.1', () => console.log('Static production test server: http://127.0.0.1:4173/Fossildle/'))
