import { config as loadDotenv } from 'dotenv'

export type NodeEnv = 'development' | 'production' | 'test'

export type AppConfig = {
  nodeEnv: NodeEnv
  port: number
  mongodbUri: string
}

let cached: AppConfig | null = null

function parseNodeEnv(value: string | undefined): NodeEnv {
  const v = value ?? 'development'
  if (v === 'development' || v === 'production' || v === 'test') {
    return v
  }
  throw new Error(
    `Invalid NODE_ENV: ${String(value)}. Expected development, production, or test.`
  )
}

function parsePort(value: string | undefined, defaultPort: number): number {
  if (value === undefined || value === '') {
    return defaultPort
  }
  const n = Number.parseInt(value, 10)
  if (Number.isNaN(n) || n < 1 || n > 65_535) {
    throw new Error(`Invalid PORT: ${String(value)}`)
  }
  return n
}

function parseConfig(): AppConfig {
  const mongodbUri = process.env.MONGODB_URI
  if (!mongodbUri || mongodbUri.trim() === '') {
    throw new Error('Missing or empty MONGODB_URI')
  }
  return {
    nodeEnv: parseNodeEnv(process.env.NODE_ENV),
    port: parsePort(process.env.PORT, 4000),
    mongodbUri,
  }
}

/**
 * Returns validated application config (env). Loads `.env` on first call.
 * Safe to call multiple times; values are read once and cached.
 */
export function getConfig(): AppConfig {
  if (!cached) {
    loadDotenv()
    cached = parseConfig()
  }
  return cached
}

/** @internal */
export function resetConfigForTests(): void {
  cached = null
}
