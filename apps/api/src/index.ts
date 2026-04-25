import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { Types } from 'mongoose'
import { getConfig } from './config/config.js'
import { connectMongoDB } from './db/mongodb.js'
import { authRouter } from './auth/presentation/router.js'
import { authMiddleware } from './auth/middleware/auth.middleware.js'
import { buildBusinessContext } from './content-pipeline/domain/services/business-context.service.js'
import { generateContentCalendar } from './content-pipeline/domain/services/content-calendar.service.js'
import { generateContentForIdea } from './content-pipeline/domain/services/content-generation.service.js'
import { BusinessContextModel } from './content-pipeline/domain/models/business-context.model.js'
import { ContentCalendarModel } from './content-pipeline/domain/models/content-calendar.model.js'
import { buildBusinessContextDto } from './content-pipeline/presentation/dtos/build-business-context.dto.js'
import { generateContentCalendarDto } from './content-pipeline/presentation/dtos/generate-content-calendar.dto.js'
import { generateContentForIdeaBodyDto } from './content-pipeline/presentation/dtos/generate-content-for-idea.dto.js'

type Env = { Variables: { userId: string } }

const app = new Hono<Env>()

app.use(cors({
  origin:       process.env.FRONTEND_URL ?? 'http://localhost:3000',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// ── Auth ───────────────────────────────────────────────────────────

app.route('/auth', authRouter)

// ── Health ─────────────────────────────────────────────────────────

app.get('/health', (c) => c.json({ status: 'ok' }))

// ── Business context ───────────────────────────────────────────────

app.post('/business-context', authMiddleware, async (c) => {
  const userId = c.get('userId')

  const raw = await c.req.json().catch(() => null)
  if (raw === null) return c.json({ error: 'Invalid JSON body' }, 400)

  const parsed = buildBusinessContextDto.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: z.flattenError(parsed.error).fieldErrors }, 400)
  }

  const doc = await buildBusinessContext({ ...parsed.data, userId })
  return c.json(doc, 201)
})

app.get('/business-contexts', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const docs = await BusinessContextModel
    .find({ userId })
    .select('_id businessName websiteUrl instagramUrl facebookUrl createdAt')
    .sort({ createdAt: -1 })
    .lean()
  return c.json(docs)
})

app.get('/business-contexts/:id', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()

  if (!Types.ObjectId.isValid(id)) return c.json({ error: 'Invalid id' }, 400)

  const doc = await BusinessContextModel.findOne({ _id: id, userId }).lean()
  if (!doc) return c.json({ error: 'Not found' }, 404)

  return c.json(doc)
})

app.get('/business-contexts/:id/calendar', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()

  if (!Types.ObjectId.isValid(id)) return c.json({ error: 'Invalid id' }, 400)

  // Verify ownership via the business context
  const owns = await BusinessContextModel.exists({ _id: id, userId })
  if (!owns) return c.json({ error: 'Not found' }, 404)

  const cal = await ContentCalendarModel
    .findOne({ businessContextId: id })
    .sort({ createdAt: -1 })
    .lean()

  return c.json(cal ?? null)
})

// ── Content calendar ───────────────────────────────────────────────

app.post('/content-calendar', authMiddleware, async (c) => {
  const userId = c.get('userId')

  const raw = await c.req.json().catch(() => null)
  if (raw === null) return c.json({ error: 'Invalid JSON body' }, 400)

  const parsed = generateContentCalendarDto.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: z.flattenError(parsed.error).fieldErrors }, 400)
  }

  // Verify the business context belongs to this user
  const owns = await BusinessContextModel.exists({ _id: parsed.data.businessContextId, userId })
  if (!owns) return c.json({ error: 'Not found' }, 404)

  const doc = await generateContentCalendar(parsed.data)
  return c.json(doc, 201)
})

app.post(
  '/content-calendar/:calendarId/ideas/:ideaId/generate',
  authMiddleware,
  async (c) => {
    const userId = c.get('userId')
    const { calendarId, ideaId } = c.req.param()

    const raw = await c.req.json().catch(() => null)
    if (raw === null) {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    const parsed = generateContentForIdeaBodyDto.safeParse(raw)
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', issues: z.flattenError(parsed.error).fieldErrors }, 400)
    }

    if (!Types.ObjectId.isValid(calendarId) || !Types.ObjectId.isValid(ideaId)) {
      return c.json({ error: 'Invalid id' }, 400)
    }

    const owns = await BusinessContextModel.exists({ _id: parsed.data.businessContextId, userId })
    if (!owns) {
      return c.json({ error: 'Not found' }, 404)
    }

    try {
      const doc = await generateContentForIdea({
        businessContextId: parsed.data.businessContextId,
        calendarId,
        ideaId,
      })
      return c.json(doc, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      if (message === 'Invalid id') {
        return c.json({ error: message }, 400)
      }
      if (/not found/i.test(message) || /may not have an id/i.test(message)) {
        return c.json({ error: message }, 404)
      }
      throw err
    }
  },
)

// ── Boot ───────────────────────────────────────────────────────────

async function main() {
  const config = getConfig()
  await connectMongoDB()
  console.log('Connected to MongoDB')

  serve(
    { fetch: app.fetch, port: config.port },
    (info) => console.log(`Server is running on http://localhost:${info.port} (${config.nodeEnv})`),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
