import mongoose from 'mongoose'
import { getConfig } from '../config/config.js'

/**
 * Connects to MongoDB using the URI from config (or an override).
 * No-op if already connected.
 */
export async function connectMongoDB(uriOverride?: string): Promise<void> {
  const uri = uriOverride ?? getConfig().mongodbUri
  if (mongoose.connection.readyState === 1) {
    return
  }
  await mongoose.connect(uri)
}

/**
 * Disconnects the default Mongoose connection.
 */
export async function disconnectMongoDB(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    return
  }
  await mongoose.disconnect()
}

export { mongoose }
