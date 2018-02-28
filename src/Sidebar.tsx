import { DOMSource } from '@cycle/dom'
import isolate from '@cycle/isolate'
import * as d3 from 'd3'
import * as R from 'ramda'
import { VNode } from 'snabbdom/vnode'
import xs, { Stream } from 'xstream'
import ButtonGroup from './ButtonGroup'
import { Thunk } from './interfaces'
import Legend, { State as LegendState } from './Legend'
import './styles/FloorList.styl'
import { Mutation } from './utils'

export type FloorStats = {
  floorId: number
  floorName: string
  count: number
}[]

export interface Sources {
  DOM: DOMSource
  nextFilename$: Stream<string>
  floorStats: Stream<FloorStats>
  floorId: Stream<number>
}

export interface Sinks {
  DOM: Stream<VNode>
  changeFloorId: Stream<Mutation<number>>
  thunk: Stream<Thunk>
  file: Stream<File>
  legendState: Stream<LegendState>
  centralizeMap: Stream<object>
}

const statsBgColor = d3
  .scaleLinear<d3.HSLColor>()
  .clamp(true)
  // green/0.1 -> red/0.4
  .range([d3.hsl('rgba(0,255,0,0.1)'), d3.hsl('rgba(255,0,0,0.4)')])
  .interpolate(d3.interpolateHsl)
const statsBarWidth = d3
  .scaleLinear()
  .range([0, 300])
  .clamp(true)
function getDefaultMax(stats: FloorStats) {
  const countList = stats.map(entry => entry.count)
  const sum = countList.reduce(R.add, 0)
  const avg = sum / countList.length
  return Math.max(countList.reduce(R.max), avg * 2)
}

export default function Sidebar(sources: Sources): Sinks {
  const domSource = sources.DOM
  const floorStats$ = sources.floorStats
  const floorId$ = sources.floorId

  const filename$ = sources.nextFilename$.startWith('test-device')

  const buttonGroup = (isolate(ButtonGroup) as typeof ButtonGroup)({
    DOM: domSource,
    filename: filename$,
  })
  const initLegendState: LegendState = {
    groundTruth: true,
    raw: true,
    cleanedRaw: true,
    semantic: true,
    tooltip: true,
  }

  const changeLegendState$ = xs.create<Mutation<LegendState>>()
  const legendState$ = changeLegendState$.fold((state, f) => f(state), initLegendState)

  const legend = (isolate(Legend) as typeof Legend)({ DOM: domSource, state: legendState$ })
  changeLegendState$.imitate(legend.mutation)

  const changeFloorId$ = domSource
    .select('.floor-item')
    .events('click')
    .map(e => Number((e.currentTarget as HTMLDivElement).dataset.floorId))
    .map(R.always)

  const max$ = floorStats$.map(getDefaultMax)
  const statsBgColor$ = max$.map(max => statsBgColor.domain([0, max]))
  const statsBarWidth$ = max$.map(max => statsBarWidth.domain([0, max]))

  const state$ = xs.combine(floorId$, floorStats$, statsBgColor$, statsBarWidth$)

  const vdom$ = xs
    .combine(state$, buttonGroup.DOM, legend.DOM)
    .map(([[floorId, floorStats, statsBgColor, statsBarWidth], buttonGroup, legend]) => (
      <div className="widgets">
        {buttonGroup}
        {legend}
        <div className="floor-list-widget">
          <div className="title">Floor Chooser</div>
          <div className="subtitle">
            <p>Floor Name</p>
            <p>Number of Raw Records</p>
          </div>
          <div className="floor-list">
            {floorStats.map(entry => (
              <div
                key={entry.floorId}
                className={`floor-item${floorId === entry.floorId ? ' active' : ''}`}
                data-floorId={String(entry.floorId)}
              >
                <div
                  className="bar"
                  style={{
                    width: statsBarWidth(entry.count) + 'px',
                    background: statsBgColor(entry.count),
                  }}
                />
                <div className="floor-name">{entry.floorName}</div>
                <div className="count">{entry.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ))

  return {
    DOM: vdom$,
    changeFloorId: changeFloorId$,
    thunk: buttonGroup.thunk,
    file: buttonGroup.file,
    legendState: legendState$,
    centralizeMap: buttonGroup.centralizeMap,
  }
}
