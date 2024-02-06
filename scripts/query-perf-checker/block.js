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
const Block = __importStar(require("../../src/storage/block"));
crypto.init('69fa4195670576c0160d660c3be36556ff8d504725be8a59b5a96509e0c994bc');
let start_time;
let end_time;
const start = async () => {
    await Storage.initializeDB();
    start_time = process.hrtime();
    await Block.queryBlockByTag('latest');
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Block.queryBlockByTag('earliest');
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Block.queryBlockByNumber(614228);
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
    start_time = process.hrtime();
    await Block.queryBlockByHash('0xa40fef5c56bcebce34d77ca18f2cfd274afb10f41a5f5f054f5ce5f17af2319a');
    end_time = process.hrtime(start_time);
    console.log('End Time', end_time);
    console.log('Time in millisecond is: ', end_time[0] * 1000 + end_time[1] / 1000000);
};
start();
//# sourceMappingURL=block.js.map