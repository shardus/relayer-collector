# Data Collector

As per the new [Data Distribution Protocol Doc](https://docs.google.com/document/d/18C5Zao5xxqy3kxSSTODkZEW3Ei0R9HI4OpyY5dSX-LU/edit?usp=sharing), the Collector is supposed to save every new chunk of data received from other archiver or distributor to a log file (under `/data-logs`) and its SQLite DB.

# Working

-> Collector Service (**`npm run collector`**)

1. The **Collector** service connects to a distributor service (as configured in `config.json`) and does two things simulataneously:

- Initiates a data syncing process in which it queries all the historical data (Accounts, Transactions, Receipts etc) from the distributor and saves it to its own SQLite DB.
- Subscribes to the real-time data from the distributor and writes it to a log file (under **`/data-logs`**) and the SQLite DB.

-> Server (**`npm run server`**)

> This API Server is used to expose the data stored in the SQLite DB to the RPC Server, if you intend to point an RPC to this collector.

-> Log Server

> The **`log_server`** (run using `npm run log_server`) that exposes an expoint named `/evm_log_subscription` to host on-chain event logs like: `eth_getLogs`.

# Usage

0. Configure the `config.json` file as per your requirements:

- Set the **ip**, **port** and **publicKey** of the distributor service you're connecting to in the `distributorInfo` object.
- Set the public and secret keys of the collector service in the `collectorInfo` object.

1. Install dependencies using:
   ```bash
   npm install && npm run prepare
   ```
2. Run the collector service using:
   ```bash
   npm run collector
   ```
