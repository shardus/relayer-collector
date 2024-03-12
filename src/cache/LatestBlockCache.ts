import { config } from '../config'
import { blockQueryDelayInMillis } from '../utils/block'
import * as db from '../storage/sqlite3storage'
import { DbBlock } from '../types'

let latestBlock: DbBlock | null = null
let lastCacheUpdateTimestamp = 0

async function getLatestBlockFromDB(): Promise<DbBlock> {
  const delayInMillis = blockQueryDelayInMillis()
  const sql = `SELECT * FROM (SELECT * FROM blocks ORDER BY number DESC LIMIT 100) AS subquery WHERE timestamp <= ${
    Date.now() - delayInMillis
  }`
  const block: DbBlock = await db.get(sql)
  return block
}

async function updateLatestBlockCacheIfNeeded(): Promise<void> {
  const now = Date.now()
  if (latestBlock === null || now - lastCacheUpdateTimestamp >= config.blockCache.cacheUpdateInterval) {
    latestBlock = await getLatestBlockFromDB()
    lastCacheUpdateTimestamp = now
  }
}

export function registerCache(): void {
  if (config.blockCache.enabled) {
    setInterval(updateLatestBlockCacheIfNeeded, config.blockCache.cacheUpdateInterval)
  }
}

export async function getLatestBlock(): Promise<DbBlock> {
  if (config.blockCache.enabled) {
    await updateLatestBlockCacheIfNeeded()
    return latestBlock
  }
  const block: DbBlock = await getLatestBlockFromDB()
  return block
}
