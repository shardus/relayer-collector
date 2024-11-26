import { P2P, StateManager } from '@shardus/types'

export interface Cycle {
  cycleMarker: StateManager.StateMetaDataTypes.CycleMarker
  counter: P2P.CycleCreatorTypes.CycleData['counter']
  cycleRecord: P2P.CycleCreatorTypes.CycleData
}
