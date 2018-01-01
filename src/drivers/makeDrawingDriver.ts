import * as d3 from 'd3'
import * as R from 'ramda'
import dropRepeats from 'xstream/extra/dropRepeats'
import sampleCombine from 'xstream/extra/sampleCombine'
import xs, { Stream } from 'xstream'
import { DataSource, Floor, RawTrace, RawTracePoint, TracePoint } from '../interfaces'
import { DrawingSink, DrawingSource } from '../App'
import { MAX_SCALE, MIN_SCALE, plainTraceNameList } from '../constants'
import {
  drawFloor,
  drawPlainTracePoints,
  getSvgFromFloor,
  getVisiblePlainPoints,
  getVisiblePlainTraces,
  drawPlaintracePaths,
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

  return function drawingDriver(drawingSink$: Stream<DrawingSink>): Stream<DrawingSource> {
    const floor$ = drawingSink$.map(sink => sink.floor).compose(dropRepeats())
    const floorId$ = floor$.map(flr => flr.floorId)
    const legendState$ = drawingSink$.map(sink => sink.legendState)
    const timeRange$ = drawingSink$.map(sink => sink.timeRange).compose(dropRepeats())
    // const centralize$ = drawingSink$.map(sink => sink.centralize)

    const dataSource$ = drawingSink$.map(sink => sink.dataSource).compose(dropRepeats())
    // .debug('data-source')
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
      error(e) {
        console.error(e)
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

    for (const traceName of plainTraceNameList) {
      const traces$ = visiblePlainTraces$[traceName]
      const wrapper$ = svg$.map(
        svg =>
          svg.select(`*[data-layer=${getPlainTraceLayerName(traceName)}]`) as d3.Selection<
            SVGElement,
            null,
            null,
            null
          >,
      )
      xs.combine(wrapper$, traces$).addListener({
        next([wrapper, traces]) {
          drawPlaintracePaths(wrapper, traces, getColor(traceName))
        },
      })
    }

    const visiblePlainPoints$ = getVisiblePlainPoints(
      plainTraces$,
      legendState$,
      floorId$,
      timeRange$,
    )

    for (const traceName of plainTraceNameList) {
      const points$ = visiblePlainPoints$[traceName]
      const wrapper$ = svg$.map(
        svg =>
          svg.select(`*[data-layer=${getPlainPointsLayerName(traceName)}]`) as d3.Selection<
            SVGElement,
            null,
            null,
            null
          >,
      )
      xs.combine(wrapper$, points$).addListener({
        next([svg, points]) {
          drawPlainTracePoints(svg, points, getColor(traceName))
        },
      })
    }

    return xs.combine(xs.of(zoom), svg$, transform$).map(([zoom, svg, transform]) => ({
      selection: svg,
      zoom,
    }))
  }
}
