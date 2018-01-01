import * as R from 'ramda'
import { VNode } from 'snabbdom/vnode'
import { Floor, DataSource } from './interfaces'
import { DOMSource } from '@cycle/dom'
import xs, { Stream } from 'xstream'
import Sidebar, { FloorStats } from './Sidebar'
import isolate from '@cycle/isolate'
import floors from '../res/floors'
import { Mutation } from './utils'

export interface DrawingSource {
  selection: d3.Selection<SVGSVGElement, null, null, null>
  zoom: d3.ZoomBehavior<SVGSVGElement, null>
}

export interface DrawingSink {
  floor: Floor
}

const dataSource: DataSource = require('../res/track.json')

export interface Sources {
  DOM: DOMSource
  drawing: Stream<DrawingSource>
}

export interface Sinks {
  DOM: Stream<VNode>
  drawing: Stream<DrawingSink>
}

export interface State {}

const svgMarkup = (
  <div>
    <svg className="map">
      <g className="board">
        <g data-layer="region" />
        <g data-layer="door" />
        <g data-layer="text" />
        <g data-layer="point" />
      </g>
    </svg>
  </div>
)

function calcualteFloorStats(dataSource: DataSource): FloorStats {
  const stats: FloorStats = []
  for (const floorId of Array.from('0123456789').map(Number)) {
    stats.push({ count: 0, floorId, floorName: `floor-${floorId}` })
  }
  dataSource.semanticTraces.forEach(item => {
    const floorId = item.floor
    const statItem = stats.find(statItem => statItem.floorId === floorId)
    statItem.count += item.data.length
  })
  return stats
}

export default function App({ DOM, drawing }: Sources): Sinks {
  const floorStats$ = xs.of(dataSource).map(calcualteFloorStats)
  const initFloorId = 0
  const changeFloorId$ = xs.create<Mutation<number>>()
  const floorId$: Stream<number> = changeFloorId$.fold((floorId, f) => f(floorId), initFloorId)
  const sidebar = (isolate(Sidebar) as typeof Sidebar)({
    DOM,
    floorStats: floorStats$,
    floorId: floorId$,
  })
  changeFloorId$.imitate(sidebar.changeFloorId)
  const floorName$ = floorId$.map(floorId => `floor-${floorId}`)

  const floorData$ = floorName$.map(floorName => {
    const n = Number(floorName[floorName.length - 1])
    return floors.find(flr => flr.floorId === n)
  })

  const svgLoad$ = DOM.select('svg.map').events('load')
  const floor$ = svgLoad$.mapTo(floorData$).flatten()

  const vdom$ = sidebar.DOM.map(sidebarVdom => (
    <div>
      {sidebarVdom}
      {svgMarkup}
    </div>
  ))

  return {
    DOM: vdom$,
    drawing: floor$.map(floor => ({ floor })),
  }
}
