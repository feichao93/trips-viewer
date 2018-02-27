export type ColorName = string

export interface Line {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Point {
  x: number
  y: number
}

export interface Floor {
  floorId: number
  buildingName: 'B'
  floorNumber: number
  regions: Region[]
  walls: Line[]
  nodes: Node[]
  doors: Door[]
  config: {
    colors: { [colorName: string]: string }
    doorwidth: number
    wallwidth: number
  }
}

export interface Node {
  id: number
  name: string
  type: string
  description: string
  labelConfig: {
    show: boolean
    pos: Point
    fontSize: number
  }
}

export interface Region {
  id: number
  color: ColorName
  nodeId: number
  points: Point[]
}

export interface Wall {
  id: number
  color: ColorName
  width: string
  line: Line
}

export interface Door {
  color: ColorName
  line: Line
  id: number
}

export interface TracePoint {
  sIndex: number
  traceIndex: number
  regionName: string
  x: number
  y: number
  startTime: number
  endTime: number
  event: string
  roomID: number
}

export interface RawTracePoint {
  x: number
  y: number
  time: number
}

export type RawTrace = {
  data: RawTracePoint[]
  floor: string
}
export interface SemanticTrace {
  traceIndex: number
  data: TracePoint[]
  floor: number
}

export interface DataSource {
  startTime: number
  groundTruthTraces: RawTrace[]
  rawTraces: RawTrace[]
  cleanedRawTraces: RawTrace[]
  semanticTraces: SemanticTrace[]
}

export interface Thunk {
  (): void
}

export interface TimeRange {
  start: number
  end: number
}

export type SVGSelection = d3.Selection<SVGElement, null, null, null>
