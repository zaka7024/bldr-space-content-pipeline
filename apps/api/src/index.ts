import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { z } from 'zod'
import { getConfig } from './config/config.js'
import { connectMongoDB } from './db/mongodb.js'
import { generate } from './content-pipeline/domain/agent.js'
import { buildBusinessContext } from './content-pipeline/domain/services/business-context.service.js'
import { buildBusinessContextDto } from './content-pipeline/presentation/dtos/build-business-context.dto.js'

const app = new Hono()

app.get('/', async (c) => {
  const result = await generate('Hello, how are you?')
  return c.text('Agent response: ' + result.text)
})

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

app.post('/business-context', async (c) => {
  const raw = await c.req.json().catch(() => null)
  if (raw === null) {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = buildBusinessContextDto.safeParse(raw)
  if (!parsed.success) {
    return c.json(
      { error: 'Validation failed', issues: z.flattenError(parsed.error).fieldErrors },
      400,
    )
  }

  const doc = await buildBusinessContext(parsed.data)
  return c.json(doc, 201)
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
