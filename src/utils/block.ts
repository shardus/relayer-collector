import { config } from '../config'

export function blockQueryDelayInMillis(): number {
  const delay = config.blockIndexing.latestBehindBySeconds * 1000
  if (config.verbose) {
    console.log('block: Querying block delay', delay)
  }
  return delay
}
