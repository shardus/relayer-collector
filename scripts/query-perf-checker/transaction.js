"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = __importStar(require("@shardus/crypto-utils"));
const Storage = __importStar(require("../../src/storage"));
const Cycle = __importStar(require("../../src/storage/cycle"));
const Transaction = __importStar(require("../../src/storage/transaction"));
const Account = __importStar(require("../../src/storage/account"));
const Block = __importStar(require("../../src/storage/block"));
crypto.init('69fa4195670576c0160d660c3be36556ff8d504725be8a59b5a96509e0c994bc');
const types_1 = require("../../src/types");
let start_time;
let end_time;
const start = async () => {
    await Storage.initializeDB();
    start_time = process.hrtime();
    await Cycle.queryCycleCount();
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Account.queryAccountCount();
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactionByTxId('519a5288caae6ba68770a37332c6769d39845439d66c77e285988abef80ea71c');
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactionByHash('0x06155712daeba2dcb25fc4d13e43006e34dac29150f0cc74a240de2103c03e07');
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactionCount();
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactions(0, 10);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactionCount(null, types_1.TransactionSearchType.AllExceptInternalTx);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactions(0, 10, null, types_1.TransactionSearchType.AllExceptInternalTx);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactionCount(null, types_1.TransactionSearchType.StakeReceipt);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactions(0, 10, null, types_1.TransactionSearchType.StakeReceipt);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactionCount(null, types_1.TransactionSearchType.UnstakeReceipt);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactions(0, 10, null, types_1.TransactionSearchType.UnstakeReceipt);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactionCount('0x41bdc7393d4360e3194c411314a79a71bfa559f2');
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactions(0, 10, '0x41bdc7393d4360e3194c411314a79a71bfa559f2');
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactionCount('0x41bdc7393d4360e3194c411314a79a71bfa559f2', types_1.TransactionSearchType.AllExceptInternalTx);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactions(0, 10, '0xed38ff1efb8207cfdfed75fad5004077819afc3a', types_1.TransactionSearchType.AllExceptInternalTx);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactionCount('0xed38ff1efb8207cfdfed75fad5004077819afc3a', types_1.TransactionSearchType.StakeReceipt);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactionCount('0x41bdc7393d4360e3194c411314a79a71bfa559f2', types_1.TransactionSearchType.StakeReceipt);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactionCount('0xed38ff1efb8207cfdfed75fad5004077819afc3a', types_1.TransactionSearchType.UnstakeReceipt);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactionCount('0x41bdc7393d4360e3194c411314a79a71bfa559f2', types_1.TransactionSearchType.UnstakeReceipt);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactionsByBlock(614520, undefined);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Transaction.queryTransactionsByBlock(undefined, '0x7fb292e81297fd1ca3ea8eb3aeadb895d4b77b3af5b8a28987a2ee1bf27a6d30');
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    const block = await Block.queryBlockByHash('0x7fb292e81297fd1ca3ea8eb3aeadb895d4b77b3af5b8a28987a2ee1bf27a6d30');
    // console.log(block)
    await Transaction.queryTransactionsByBlock(block.number, undefined);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    //   const promises = [
    //     Cycle.queryCycleCount().then((res) => {
    //       end_time = process.hrtime(start_time)
    //       console.log('End Time', end_time)
    //       console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000)
    //     }),
    //     Transaction.queryTransactionCount(null, TransactionSearchType.AllExceptInternalTx).then((res) => {
    //       end_time = process.hrtime(start_time)
    //       console.log('End Time', end_time)
    //       console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000)
    //     }),
    //     Transaction.queryTransactionCount(null, TransactionSearchType.StakeReceipt).then((res) => {
    //       end_time = process.hrtime(start_time)
    //       console.log('End Time', end_time)
    //       console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000)
    //     }),
    //     Transaction.queryTransactionCount(null, TransactionSearchType.UnstakeReceipt).then((res) => {
    //       end_time = process.hrtime(start_time)
    //       console.log('End Time', end_time)
    //       console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000)
    //     }),
    //   ]
    //   start_time = process.hrtime()
    //   Promise.allSettled(promises)
    //     .then((responses) => {
    //       let i = 0
    //       for (const response of responses) {
    //         if (response.status === 'fulfilled') {
    //           // const res = response.value
    //         } else {
    //           console.log(response)
    //         }
    //       }
    //     })
    //     .catch((error) => {
    //       // Handle any errors that occurred
    //       console.error(error)
    //     })
};
start();
//# sourceMappingURL=transaction.js.map