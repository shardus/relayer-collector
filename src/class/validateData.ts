import * as crypto from '@shardus/crypto-utils'
import * as utils from '../utils'
import { config as CONFIG, config } from '../config'
import { insertOrUpdateCycle } from '../storage/cycle'
import { processReceiptData } from '../storage/receipt'
import { processOriginalTxData } from '../storage/originalTxData'
import { CycleLogWriter, ReceiptLogWriter, OriginalTxDataLogWriter } from './DataLogWriter'
import { upsertBlocksForCycle, upsertBlocksForCycleCore } from '../storage/block'

export interface Data {
  receipt?: any
  cycle?: any
  originalTx?: any
  sign: {
    owner: string
    sig: string
  }
}

export async function validateData(data: Data): Promise<void> {
  let err = utils.validateTypes(data, {
    sign: 'o',
    receipt: 'o?',
    cycle: 'o?',
    originalTx: 'o?',
  })
  if (err) {
    console.error('Data received from distributor failed validation', err)
    return
  }
  err = utils.validateTypes(data.sign, { owner: 's', sig: 's' })
  if (err) {
    return
  }
  if (data.sign.owner !== CONFIG.distributorInfo.publicKey) {
    console.error('Data received from distributor has invalid key')
    return
  }
  if (!crypto.verifyObj(data)) {
    console.error('Data received from distributor has invalid signature')
    return
  }
  if (!data.receipt && !data.cycle && !data.originalTx) {
    console.error('Data received from distributor is invalid', data)
    return
  }

  if (data.receipt) {
    ReceiptLogWriter.writeToLog(`${JSON.stringify(data.receipt)}\n`)
    await processReceiptData([data.receipt])
  }
  if (data.cycle) {
    CycleLogWriter.writeToLog(`${JSON.stringify(data.cycle)}\n`)
    await insertOrUpdateCycle(data.cycle)
    // optimistically upsert blocks for next cycle if it is wrong, it will be corrected in next cycle
    await upsertBlocksForCycleCore(
      data.cycle.counter + 1,
      data.cycle.cycleRecord.start + config.blockIndexing.cycleDurationInSeconds
    )
  }
  if (data.originalTx) {
    OriginalTxDataLogWriter.writeToLog(`${JSON.stringify(data.originalTx)}\n`)
    await processOriginalTxData([data.originalTx])
  }
}
