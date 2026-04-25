import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { getConfig } from './config/config.js'
import { connectMongoDB } from './db/mongodb.js'
import { generate } from './content-pipeline/domain/agent.js'

const app = new Hono()

app.get('/', async (c) => {
  const result = await generate('Hello, how are you?')
  return c.text('Agent response: ' + result.text)
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
