import * as d3 from 'd3'
import * as R from 'ramda'
import xs, { Stream } from 'xstream'
import dropRepeats from 'xstream/extra/dropRepeats'
import sampleCombine from 'xstream/extra/sampleCombine'
import { DrawingSink, DrawingSource } from '../App'
import { MAX_SCALE, MIN_SCALE, plainTraceNameList } from '../constants'
import { DataSource, Floor, RawTrace, RawTracePoint, TracePoint, SVGSelection } from '../interfaces'
import {
  drawFloor,
  drawPlainTracePoints,
  getSvgFromFloor,
  getVisiblePlainPoints,
  getVisiblePlainTraces,
  drawPlaintracePaths,
  getPlainPathWrapper,
  getPlainPointsWrapper,
  drawSemanticPoints,
} from './drawing'
import {
  getColor,
  getRawTracePoints,
  getTransformStream,
  noop,
  getPlainPointsLayerName,
  getPlainTraceLayerName,
} from '../utils'

export default function makeDrawingDriver() {
  const zoom = d3.zoom() as d3.ZoomBehavior<SVGSVGElement, null>
  zoom.scaleExtent([MIN_SCALE, MAX_SCALE])
  const transform$ = getTransformStream(zoom)

  return function drawingDriver(drawingSink: DrawingSink): DrawingSource {
    const floor$ = drawingSink.map(sink => sink.floor).compose(dropRepeats())
    const legendState$ = drawingSink.map(sink => sink.legendState).compose(dropRepeats())
    const timeRange$ = drawingSink.map(sink => sink.timeRange).compose(dropRepeats())
    const dataSource$ = drawingSink.map(sink => sink.dataSource).compose(dropRepeats())
    const sIndex$ = drawingSink.map(sink => sink.sIndex).compose(dropRepeats())
    const traceToCentralize$ = drawingSink
      .map(sink => sink.traceToCentralize)
      .compose(dropRepeats())

    const floorId$ = floor$.map(flr => flr.floorId)

    const plainTraces$ = {
      groundTruth: dataSource$.map(source => source.groundTruthTraces),
      raw: dataSource$.map(source => source.rawTraces),
      cleanedRaw: dataSource$.map(source => source.cleanedRawTraces),
    }

    const svg$ = floor$.map(getSvgFromFloor)

    svg$.take(1).addListener({
      next(svg) {
        svg.call(zoom)
      },
    })

    let resetTransform = true
    floor$.addListener({
      next(floor) {
        drawFloor(floor, resetTransform, { zoom })
        resetTransform = false
      },
    })

    xs.combine(svg$, transform$).addListener({
      next([svg, transform]) {
        const { x, y, k } = transform
        svg.select('.board').attr('transform', `translate(${x},${y}) scale(${k})`)
      },
    })

    // xs.combine(svg$, centralize$.filter(R.identity)).addListener({
    //   next([svg]) {
    //     const regionLayer = svg.select('*[data-layer=region]')
    //     const node = regionLayer.node() as SVGGElement
    //     const contentBox = node.getBBox()
    //     const padding = { top: 50, bottom: 50, left: 450, right: 360 }
    //     const svgNode = svg.node()
    //     const viewBox = { width: svgNode.clientWidth, height: svgNode.clientHeight }
    //     const targetTransform = doCentralize(contentBox, viewBox, padding)
    //     if (targetTransform) {
    //       zoom.transform(svg.transition(), targetTransform)
    //     }
    //   },
    // })

    const visiblePlainTraces$ = getVisiblePlainTraces(plainTraces$, legendState$, floorId$)
    const visiblePlainPoints$ = getVisiblePlainPoints(
      plainTraces$,
      legendState$,
      floorId$,
      timeRange$,
    )

    for (const traceName of plainTraceNameList) {
      const traces$ = visiblePlainTraces$[traceName]
      const pathWrapper$ = svg$.map(svg => getPlainPathWrapper(svg, traceName))
      xs.combine(pathWrapper$, traces$).addListener({
        next([wrapper, traces]) {
          drawPlaintracePaths(wrapper, traces, getColor(traceName))
        },
      })

      const points$ = visiblePlainPoints$[traceName]
      const pointsWrapper$ = svg$.map(svg => getPlainPointsWrapper(svg, traceName))
      xs.combine(pointsWrapper$, points$).addListener({
        next([svg, points]) {
          drawPlainTracePoints(svg, points, getColor(traceName))
        },
      })
    }

    const semanticTraces$ = dataSource$.map(source => source.semanticTraces)
    const visibleSemanticTraces$ = xs
      .combine(semanticTraces$, floorId$, legendState$)
      .map(([semanticTraces, floorId, visibility]) => {
        if (visibility.semantic) {
          return semanticTraces.filter(tr => tr.floor === floorId)
        } else {
          return []
        }
      })

    const nextSIndex$ = xs.create<number>({
      start(listener) {
        xs.combine(svg$, visibleSemanticTraces$, sIndex$).addListener({
          next([svg, traces, sIndex]) {
            const layer = svg.select('*[data-layer=semantic-points]') as SVGSelection
            drawSemanticPoints(layer, traces, sIndex, (d: { sIndex: number }) =>
              listener.next(d.sIndex),
            )
          },
        })
      },
      stop() {},
    })

    return xs.combine(nextSIndex$).map(([nextSIndex]) => ({
      nextSIndex,
    }))
  }
}
