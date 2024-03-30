import dotenv from 'dotenv'
dotenv.config()

import * as Crypto from '../src/utils/crypto'
import * as Storage from '../src/storage'
import * as db from '../src/storage/sqlite3storage'
import * as CycleDB from '../src/storage/cycle'
import * as BlockDB from '../src/storage/block'
import { config, overrideDefaultConfig } from '../src/config'

const patchCycleData = false
const patchBlockData = false

const start = async (): Promise<void> => {
  overrideDefaultConfig(process.env, process.argv)
  // Set crypto hash keys from config
  Crypto.setCryptoHashKey(config.hashKey)
  await Storage.initializeDB()

  let lastStoredCycleCount = await CycleDB.queryCycleCount()
  let lastStoredCycle = (await CycleDB.queryLatestCycleRecords(1))[0]
  console.log('lastStoredCycleCount', lastStoredCycleCount, 'lastStoredCycleCounter', lastStoredCycle.counter)

  if (lastStoredCycleCount > 0 && lastStoredCycle.counter !== lastStoredCycleCount - 1) {
    console.error('Stored cycle count does not match the last cycle counter')
  }
  await checkCycleDataExists(0, lastStoredCycle.counter)
  console.log('Cycle data check complete.')
}

/**
 * Generate an array of numbers within a specified range.
 */
function generateNumberArray(startNumber: number, endNumber: number) {
  const numberOfItems = endNumber - startNumber + 1
  const items = Array.from({ length: numberOfItems }, (_, i) => startNumber + i)
  return items
}

async function checkCycleDataExists(startCycleNumber = 0, latestCycleNumber: number) {
  try {
    // Divide blocks into batches (e.g., batches of 1000 cycles each)
    const batchSize = 1000
    const cycleBatches: number[][] = []
    let end = startCycleNumber + batchSize
    for (let start = startCycleNumber; start <= latestCycleNumber; ) {
      if (end > latestCycleNumber) end = latestCycleNumber
      cycleBatches.push(generateNumberArray(start, end))
      start = end + 1
      end += batchSize
    }

    // Query cycle in batches in parallel using Promise.allSettled
    const promises = cycleBatches.map(async (cycleNumberBatch: number[]) => {
      const sql =
        'SELECT counter FROM cycles WHERE counter IN (' + cycleNumberBatch + ') ORDER BY counter ASC'
      return db.all(sql)
    })

    const results = await Promise.allSettled(promises)

    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const cycles = cycleBatches[index]
        const existingCycles = result.value.map((row: any) => row.counter)
        if (existingCycles.length !== cycles.length) console.log(existingCycles)
        const missingCycles = cycles.filter((cycle) => !existingCycles.includes(cycle))
        if (missingCycles.length > 0) console.log('Missing cycles:', missingCycles)
      } else {
        console.error('Error checking cycles existence:', result.reason)
      }
    })
  } catch (error) {
    console.error('Error checking cycle data:', error)
  }
}

async function checkBlockDataExists(startBlockNumber = 0, latestBlockNumber: number) {
  try {
    // Divide blocks into batches (e.g., batches of 1000 blocks each)
    const batchSize = 1000
    const blockBatches: number[][] = []
    let end = startBlockNumber + batchSize
    for (let start = startBlockNumber; start <= latestBlockNumber; ) {
      if (end > latestBlockNumber) end = latestBlockNumber
      blockBatches.push(generateNumberArray(start, end))
      start = end + 1
      end += batchSize
    }

    // Query block in batches in parallel using Promise.allSettled
    const promises = blockBatches.map(async (blockNumberBatch: number[]) => {
      const sql =
        'SELECT blockNumber FROM blocks WHERE blockNumber IN (' +
        blockNumberBatch +
        ') ORDER BY blockNumber ASC'
      return db.all(sql)
    })

    const results = await Promise.allSettled(promises)

    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const blocks = blockBatches[index]
        const existingBlocks = result.value.map((row: any) => row.counter)
        if (existingBlocks.length !== blocks.length) console.log(existingBlocks)
        const missingBlocks = blocks.filter((block) => !existingBlocks.includes(block))
        if (missingBlocks.length > 0) console.log('Missing blocks:', missingBlocks)
      } else {
        console.error('Error checking blocks existence:', result.reason)
      }
    })
  } catch (error) {
    console.error('Error checking block data:', error)
  }
}

start()
