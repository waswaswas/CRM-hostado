import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
 
const port = parseInt(process.env.PORT || '3000', 10)
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()
 
app.prepare().then(() => {
  createServer((req, res) => {
    try {
      handle(req, res, parse(req.url, true))
    } catch (err) {
      console.error('Error handling request:', err)
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  }).listen(port, () => {
    console.log(
      `> Server listening on port ${port} in ${dev ? 'development' : 'production'} mode`
    )
  })
}).catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})