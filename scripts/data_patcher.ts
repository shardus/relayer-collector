import dotenv from 'dotenv'
dotenv.config()

import * as crypto from '@shardus/crypto-utils'
import * as Storage from '../src/storage'
import * as DataSync from '../src/class/DataSync'
import { config } from '../src/config'

crypto.init(config.hashKey)

let startCycle = 0
let endCycle = 0

const cycleNumberToSyncFrom = process.argv[2]
const cycleNumberToSyncTo = process.argv[3]

const patchOnlyMissingData = true

// Setup Log Directory
const start = async (): Promise<void> => {
  await Storage.initializeDB()

  if (cycleNumberToSyncFrom) {
    startCycle = parseInt(cycleNumberToSyncFrom)
  }
  if (cycleNumberToSyncTo) {
    endCycle = parseInt(cycleNumberToSyncTo)
  } else {
    const response = await DataSync.queryFromDistributor(DataSync.DataType.TOTALDATA, {})
    if (response.data && response.data.totalReceipts >= 0 && response.data.totalCycles >= 0) {
      endCycle = response.data.totalCycles
    }
  }
  console.log('Start Cycle', startCycle, 'End Cycle', endCycle)

  await DataSync.downloadAndSyncGenesisAccounts() // To sync accounts data that are from genesis accounts/accounts data that the network start with

  await DataSync.downloadCyclcesBetweenCycles(startCycle, endCycle, patchOnlyMissingData)
  console.log('Cycles Patched!')
  await DataSync.downloadReceiptsBetweenCycles(startCycle, endCycle, patchOnlyMissingData)
  console.log('Receipts Patched!')
  await DataSync.downloadOriginalTxsDataBetweenCycles(startCycle, endCycle, patchOnlyMissingData)
  console.log('OriginalTxs Patched!')

  console.log('Patching done! from cycle', startCycle, 'to cycle', endCycle)
}

start()
