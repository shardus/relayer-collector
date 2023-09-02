import dotenv from 'dotenv'
dotenv.config()

import * as crypto from '@shardus/crypto-utils'
import * as Storage from './storage'
import * as DataSync from './class/DataSync'
import { DISTRIBUTOR_URL } from './config'

crypto.init('69fa4195670576c0160d660c3be36556ff8d504725be8a59b5a96509e0c994bc')

// config variables
import axios from 'axios'

let startCycle = 0

const cycleNumberToSyncFrom = process.argv[2]
if (cycleNumberToSyncFrom) {
  startCycle = parseInt(cycleNumberToSyncFrom)
}
console.log('Start Cycle', startCycle)

// Setup Log Directory
const start = async (): Promise<void> => {
  await Storage.initializeDB()

  let totalCyclesToSync = 0
  const response = await axios.get(`${DISTRIBUTOR_URL}/totalData`)
  if (response.data && response.data.totalReceipts >= 0 && response.data.totalCycles >= 0) {
    totalCyclesToSync = response.data.totalCycles
    console.log('totalCyclesToSync', totalCyclesToSync)
  }

  await DataSync.downloadAndSyncGenesisAccounts() // To sync accounts data that are from genesis accounts/accounts data that the network start with

  console.log('startCycle', startCycle, 'totalCyclesToSync', totalCyclesToSync)
  await DataSync.downloadReceiptsBetweenCycles(startCycle, totalCyclesToSync)
  console.log('Receipts Patched!')
  await DataSync.downloadOriginalTxsDataBetweenCycles(startCycle, totalCyclesToSync)
  console.log('OriginalTxs Patched!')

  console.log('Patching done! from cycle', startCycle, 'to cycle', totalCyclesToSync)
}

start()
