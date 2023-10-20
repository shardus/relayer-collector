import { bytesToHex } from '@ethereumjs/util'
import { config } from '../config'
import * as db from './sqlite3storage'
import { Block as EthBlock } from '@ethereumjs/block'
import { Common, Hardfork } from '@ethereumjs/common'
import { Cycle } from './cycle'

const evmCommon = new Common({ chain: 'mainnet', hardfork: Hardfork.Istanbul, eips: [3855] })

export interface DbBlock {
  number: number
  numberHex: string
  hash: string
  timestamp: number
  cycle: number
}

export async function insertBlock(block: DbBlock): Promise<void> {
  try {
    const fields = Object.keys(block).join(', ')
    const placeholders = Object.keys(block).fill('?').join(', ')
    const values = db.extractValues(block)
    const sql = 'INSERT OR REPLACE INTO blocks (' + fields + ') VALUES (' + placeholders + ')'
    await db.run(sql, values)
    /*prettier-ignore*/ if (config.verbose) console.log('block: Successfully inserted block', block.number, block.hash)
  } catch (e) {
    console.log(e)
    /*prettier-ignore*/ console.log('block: Unable to insert block or it is already stored in to database', block.number, block.hash)
  }
}

export async function bulkInsertBlocks(blocks: DbBlock[]): Promise<void> {
  try {
    const fields = Object.keys(blocks[0]).join(', ')
    const placeholders = Object.keys(blocks[0]).fill('?').join(', ')
    const values = db.extractValuesFromArray(blocks)
    let sql = 'INSERT OR REPLACE INTO blocks (' + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < blocks.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    await db.run(sql, values)
    /*prettier-ignore*/ console.log('block: Successfully bulk inserted blocks', blocks.length)
  } catch (e) {
    console.log(e)
    /*prettier-ignore*/ console.log('block: Unable to bulk insert blocks', blocks.length)
  }
}

export async function upsertBlocksForCycle(cycle: Cycle): Promise<void> {
  await upsertBlocksForCycleCore(cycle.counter, cycle.cycleRecord.start)
}

export async function upsertBlocksForCycleCore(
  cycleCounter: number,
  startTimeInSeconds: number
): Promise<void> {
  /*prettier-ignore*/ if (config.verbose) console.log(`block: Creating blocks for cycle ${cycleCounter} with start timestamp ${startTimeInSeconds}`)
  const numBlocksPerCycle =
    config.blockIndexing.cycleDurationInSeconds / config.blockIndexing.blockProductionRate
  let firstBlockNumberForCycle = 0
  for (let i = 0; i < numBlocksPerCycle; i++) {
    const blockNumber = Math.floor(
      config.blockIndexing.initBlockNumber + cycleCounter * numBlocksPerCycle + i
    )
    if (i === 0) {
      firstBlockNumberForCycle = blockNumber
    }
    const newBlockTimestampInSecond =
      startTimeInSeconds +
      (blockNumber - config.blockIndexing.initBlockNumber - firstBlockNumberForCycle) *
        config.blockIndexing.blockProductionRate
    const newBlockTimestamp = newBlockTimestampInSecond * 1000
    const block = createNewBlock(blockNumber, newBlockTimestamp)
    /*prettier-ignore*/ if (config.verbose) console.log(`Block number: ${block.header.number}, timestamp: ${block.header.timestamp}, hash: ${bytesToHex(block.header.hash())}`)
    await insertBlock({
      number: Number(block.header.number),
      numberHex: '0x' + block.header.number.toString(16),
      hash: bytesToHex(block.header.hash()),
      timestamp: newBlockTimestamp,
      cycle: cycleCounter,
    })
  }
  /*prettier-ignore*/ if (config.verbose) console.log(`block: Successfully created ${numBlocksPerCycle} blocks for cycle ${cycleCounter}`)
}

export async function queryBlockByNumber(blockNumber: number): Promise<DbBlock | null> {
  /*prettier-ignore*/ if (config.verbose) console.log('block: Querying block by number', blockNumber)
  try {
    const sql = 'SELECT * FROM blocks WHERE numberHex = ?'
    const values = [blockNumber]
    const block: DbBlock = await db.get(sql, values)
    return block
  } catch (e) {
    /*prettier-ignore*/ console.log('block: Unable to query block', blockNumber, e)
    return null
  }
}

export async function queryBlockByHash(blockHash: string): Promise<DbBlock | null> {
  /*prettier-ignore*/ if (config.verbose) console.log('block: Querying block by hash', blockHash)
  try {
    const sql = 'SELECT * FROM blocks WHERE hash = ?'
    const values = [blockHash]
    const block: DbBlock = await db.get(sql, values)
    return block
  } catch (e) {
    /*prettier-ignore*/ console.log('block: Unable to query block', blockHash, e)
    return null
  }
}

export async function upsertBlocksForCycles(cycles: Cycle[]): Promise<void> {
  /*prettier-ignore*/ if (config.verbose) console.log(`block: Creating blocks for ${cycles.length} cycles`)
  for (const cycle of cycles) {
    await upsertBlocksForCycle(cycle)
  }
}

export function createNewBlock(blockNumber: number, timestamp: number): EthBlock {
  const timestampInSecond = timestamp ? Math.round(timestamp / 1000) : Math.round(Date.now() / 1000)
  const blockData = {
    header: { number: blockNumber, timestamp: timestampInSecond },
    transactions: [],
    uncleHeaders: [],
  }
  const block = EthBlock.fromBlockData(blockData, { common: evmCommon })
  return block
}
