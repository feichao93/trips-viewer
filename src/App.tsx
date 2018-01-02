import { DOMSource } from '@cycle/dom'
import isolate from '@cycle/isolate'
import * as R from 'ramda'
import { VNode } from 'snabbdom/vnode'
import xs, { Stream } from 'xstream'
import pairwise from 'xstream/extra/pairwise'
import sampleCombine from 'xstream/extra/sampleCombine'
import { plainTraceNameList } from './constants'
import { ShortcutSource } from './drivers/makeShortcutDriver'
import { DataSource, Floor, SemanticTrace, Thunk, TimeRange } from './interfaces'
import { State as LegendState } from './Legend'
import Sidebar, { FloorStats } from './Sidebar'
import TimelinePanel from './TimelinePanel'
import floors from '../res/floors'
import {
  getSemanticTracePoints,
  Mutation,
  getPlainPointsLayerName,
  getPlainTraceLayerName,
  getTrace,
} from './utils'

export type DrawingSource = Stream<{
  nextSIndex: number
}>

export type DrawingSink = Stream<{
  floor: Floor
  dataSource: DataSource
  legendState: LegendState
  timeRange: TimeRange
  sIndex: number
  traceToCentralize: SemanticTrace
}>

export interface Sources {
  DOM: DOMSource
  drawing: DrawingSource
  file: Stream<DataSource>
  shortcut: ShortcutSource
}

export interface Sinks {
  DOM: Stream<VNode>
  drawing: DrawingSink
  thunk: Stream<Thunk>
  file: Stream<File>
}

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
        <g data-layer="semantic-points" />
      </g>
    </svg>
  </div>
)

function calcualteFloorStats(dataSource: DataSource): FloorStats {
  const stats: FloorStats = []
  for (const floorId of Array.from('0123456789').map(Number)) {
    stats.push({ count: 0, floorId, floorName: `floor-${floorId}` })
  }
  dataSource.rawTraces.forEach(rawTrace => {
    const floorId = Number(rawTrace.floor)
    const statItem = stats.find(statItem => statItem.floorId === floorId)
    statItem.count += rawTrace.data.length
  })
  return stats
}

export default function App(sources: Sources): Sinks {
  const domSource = sources.DOM
  const initDataSource: DataSource = require('../res/track.json')
  const dataSource$ = sources.file.startWith(initDataSource)
  const floorStats$ = dataSource$.map(calcualteFloorStats)

  const initFloorId = initDataSource.semanticTraces[0].floor
  const changeFloorIdProxy$ = xs.create<Mutation<number>>()
  const floorId$: Stream<number> = changeFloorIdProxy$.fold((floorId, f) => f(floorId), initFloorId)
  const sidebar = Sidebar({
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

  const nextSIndexProxy$ = xs.create<number>()
  const sIndex$ = nextSIndexProxy$.startWith(0)
  const timeRange$ = xs.combine(dataSource$, sIndex$).map(([dataSource, sIndex]) => {
    const points = getSemanticTracePoints(dataSource.semanticTraces)
    const p = points[sIndex]
    if (p == null) {
      return { start: -1, end: -1 }
    } else {
      return { start: p.startTime, end: p.endTime }
    }
  })

  const timelinePanel = TimelinePanel({
    DOM: domSource,
    sIndex: sIndex$,
    semanticTraces: dataSource$.map(d => d.semanticTraces),
    shortcut: sources.shortcut,
  })
  nextSIndexProxy$.imitate(
    xs.merge(timelinePanel.nextSIndex, sources.drawing.map(d => d.nextSIndex)),
  )

  const nextTraceInAnotherFloor$ = timelinePanel.nextSIndex
    .compose(sampleCombine(dataSource$))
    .map(getTrace)
    .compose(sampleCombine(floorId$))
    .filter(([nextTrace, cnt]) => cnt !== nextTrace.floor)
    .map(([nextTrace, cnt]) => nextTrace)
    .startWith(null)

  changeFloorIdProxy$.imitate(
    xs.merge(
      nextTraceInAnotherFloor$.filter(R.identity).map(tr => R.always(tr.floor)),
      sidebar.changeFloorId,
    ),
  )

  const vdom$ = xs.combine(sidebar.DOM, timelinePanel.DOM).map(([sidebar, timelinePanel]) => (
    <div>
      {sidebar}
      {svgMarkup}
      {timelinePanel}
    </div>
  ))

  return {
    DOM: vdom$,
    drawing: xs
      .combine(
        floor$,
        dataSource$,
        sidebar.legendState,
        timeRange$,
        sIndex$,
        nextTraceInAnotherFloor$,
      )
      .map(([floor, dataSource, legendState, timeRange, sIndex, traceToCentralize]) => ({
        floor,
        dataSource,
        legendState,
        timeRange,
        sIndex,
        traceToCentralize,
      })),
    thunk: sidebar.thunk,
    file: sidebar.file,
  }
}
