import * as R from 'ramda'
import floors from '../res/floors'
import isolate from '@cycle/isolate'
import pairwise from 'xstream/extra/pairwise'
import sampleCombine from 'xstream/extra/sampleCombine'
import Sidebar, { FloorStats } from './Sidebar'
import TimelinePanel from './TimelinePanel'
import xs, { Stream } from 'xstream'
import { DataSource, Floor, Thunk, TimeRange } from './interfaces'
import { DOMSource } from '@cycle/dom'
import {
  getSemanticTracePoints,
  Mutation,
  getPlainPointsLayerName,
  getPlainTraceLayerName,
} from './utils'
import { State as LegendState } from './Legend'
import { VNode } from 'snabbdom/vnode'
import { plainTraceNameList } from './constants'

export interface DrawingSource {
  selection: d3.Selection<SVGSVGElement, null, null, null>
  zoom: d3.ZoomBehavior<SVGSVGElement, null>
}

export interface DrawingSink {
  floor: Floor
  dataSource: DataSource
  legendState: LegendState
  timeRange: TimeRange
  sIndex: number
  centralize: boolean
}

export interface Sources {
  DOM: DOMSource
  drawing: Stream<DrawingSource>
  file: Stream<DataSource>
}

export interface Sinks {
  DOM: Stream<VNode>
  drawing: Stream<DrawingSink>
  thunk: Stream<Thunk>
  file: Stream<File>
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
        {plainTraceNameList.map(name => <g data-layer={getPlainTraceLayerName(name)} />)}
        {plainTraceNameList.map(name => <g data-layer={getPlainPointsLayerName(name)} />)}
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

export default function App(sources: Sources): Sinks {
  const domSource = sources.DOM
  const dataSource$ = sources.file.startWith(require('../res/track.json'))
  const floorStats$ = dataSource$.map(calcualteFloorStats)

  const initFloorId = 0
  const changeFloorId$ = xs.create<Mutation<number>>()
  const floorId$: Stream<number> = changeFloorId$.fold((floorId, f) => f(floorId), initFloorId)
  const sidebar = (isolate(Sidebar) as typeof Sidebar)({
    DOM: domSource,
    floorStats: floorStats$,
    floorId: floorId$,
  })
  const floorName$ = floorId$.map(floorId => `floor-${floorId}`)

  const floorData$ = floorName$.map(floorName => {
    const n = Number(floorName[floorName.length - 1])
    return floors.find(flr => flr.floorId === n)
  })

  const svgLoad$ = domSource.select('svg.map').events('load')
  const floor$ = svgLoad$.mapTo(floorData$).flatten()

  const changeSIndex = xs.create<Mutation<number>>()
  const sIndex$ = changeSIndex.fold((sIndex, f) => f(sIndex), 0)
  const timeRange$ = xs.combine(dataSource$, sIndex$).map(([dataSource, sIndex]) => {
    const points = getSemanticTracePoints(dataSource.semanticTraces)
    const p = points[sIndex]
    if (p == null) {
      return { start: -1, end: -1 }
    } else {
      return { start: p.startTime, end: p.endTime }
    }
  })
  const changeFloorIdAccordingToSIndex$ = xs
    .combine(dataSource$, sIndex$)
    .map(getFloor)
    .compose(sampleCombine(floorId$))
    .filter(([next, cnt]) => cnt !== next)
    .map(([next, cnt]) => next)
    .map(R.always)

  // changeFloorIdAccordingToSIndex$.map() // TODO centralize the trace
  changeFloorId$.imitate(xs.merge(sidebar.changeFloorId, changeFloorIdAccordingToSIndex$))

  const timelinePanel = TimelinePanel({
    DOM: domSource,
    sIndex: sIndex$,
    semanticTraces: dataSource$.map(d => d.semanticTraces),
  })
  changeSIndex.imitate(timelinePanel.changeSIndex)

  const vdom$ = xs.combine(sidebar.DOM, timelinePanel.DOM).map(([sidebar, timelinePanel]) => (
    <div>
      {sidebar}
      {svgMarkup}
      {timelinePanel}
    </div>
  ))

  const centralize$ = changeFloorIdAccordingToSIndex$
    .map(s => xs.of(true, false))
    .flatten()
    .startWith(false)

  return {
    DOM: vdom$,
    drawing: xs
      .combine(floor$, dataSource$, sidebar.legendState, timeRange$, sIndex$, centralize$)
      .map(([floor, dataSource, legendState, timeRange, sIndex, centralize]) => ({
        floor,
        dataSource,
        legendState,
        timeRange,
        sIndex,
        centralize,
      })),
    thunk: sidebar.thunk,
    file: sidebar.file,
  }
}

function getFloor([{ semanticTraces: traces }, sIndex]: [DataSource, number]) {
  let t = 0
  for (let i = 0; i < traces.length; i++) {
    const trace = traces[i]
    t += trace.data.length
    if (t > sIndex) {
      return trace.floor
    }
  }
  throw new Error(`Invalid sIndex ${sIndex}`)
}
