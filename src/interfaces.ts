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
  regionName: string
  x: number
  y: number
  startTime: number
  endTime: number
  event: string
}

export interface DataSource {
  startTime: number
  semanticTraces: {
    data: TracePoint[]
    floor: number
  }[]
}
