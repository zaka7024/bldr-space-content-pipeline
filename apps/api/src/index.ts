import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { getConfig } from './config/config.js'
import { connectMongoDB } from './db/mongodb.js'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

async function main() {
  const config = getConfig()
  await connectMongoDB()
  console.log('Connected to MongoDB')

  serve(
    {
      fetch: app.fetch,
      port: config.port,
    },
    (info) => {
      console.log(
        `Server is running on http://localhost:${info.port} (${config.nodeEnv})`
      )
    }
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
