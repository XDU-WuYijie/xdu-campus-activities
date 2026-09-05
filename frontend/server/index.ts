import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'

const currentDir = dirname(fileURLToPath(import.meta.url))
const distDir = join(currentDir, '..', 'dist')
const port = Number(process.env.PORT || 3000)
const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8081'

if (!existsSync(join(distDir, 'index.html'))) {
  console.error('Missing frontend/dist. Run "npm run build" before "npm start".')
  process.exit(1)
}

const app = express()
const backendProxy = createProxyMiddleware({
  pathFilter: '/api',
  target: backendUrl,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/api': '' },
})

app.use(backendProxy)
app.use(express.static(distDir))
app.use((_request, response) => {
  response.sendFile(join(distDir, 'index.html'))
})

const server = createServer(app)
server.on('upgrade', backendProxy.upgrade)
server.listen(port, () => {
  console.log(`Frontend listening on http://127.0.0.1:${port}`)
  console.log(`Proxying API and WebSocket requests to ${backendUrl}`)
})
