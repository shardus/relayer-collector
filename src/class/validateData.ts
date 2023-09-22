import * as crypto from '@shardus/crypto-utils'
import * as utils from '../utils'
import { config as CONFIG } from '../config'
import { insertOrUpdateCycle } from '../storage/cycle'
import { processReceiptData } from '../storage/receipt'
import { processOriginalTxData } from '../storage/originalTxData'
import { CycleLogWriter, ReceiptLogWriter, OriginalTxDataLogWriter } from './DataLogWriter'

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
    originalTxsDat: 'o?',
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
    ReceiptLogWriter.writeDataLog(`${JSON.stringify(data.receipt)}\n`)
    await processReceiptData([data.receipt])
  }
  if (data.cycle) {
    CycleLogWriter.writeDataLog(`${JSON.stringify(data.cycle)}\n`)
    await insertOrUpdateCycle(data.cycle)
  }
  if (data.originalTx) {
    OriginalTxDataLogWriter.writeDataLog(`${JSON.stringify(data.originalTx)}\n`)
    await processOriginalTxData([data.originalTx])
  }
}
