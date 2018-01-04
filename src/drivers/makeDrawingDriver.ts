import * as d3 from 'd3'
import * as R from 'ramda'
import xs from 'xstream'
import debounce from 'xstream/extra/debounce'
import dropRepeats from 'xstream/extra/dropRepeats'
import sampleCombine from 'xstream/extra/sampleCombine'
import { DrawingSink, DrawingSource } from '../App'
import { MAX_SCALE, MIN_SCALE, plainTraceNameList } from '../constants'
import { SVGSelection, TracePoint } from '../interfaces'
import { getColor, getTransformStream, formatTime } from '../utils'
import {
  doCentralize,
  drawFloor,
  drawPlaintracePaths,
  drawPlainTracePoints,
  drawSemanticPath,
  drawSemanticPoints,
  getPlainPathWrapper,
  getPlainPointsWrapper,
  getSvgFromFloor,
  getVisiblePlainPoints,
  getVisiblePlainTraces,
  drawTooltip,
} from './drawing'

const error = (e: Error) => {
  throw e
}

const resize$ = xs.create<UIEvent>({
  start(listener) {
    window.addEventListener('resize', e => listener.next(e))
  },
  stop() {},
})

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
      .filter(R.identity)
    const centralizeMap$ = drawingSink
      .map(sink => sink.centralizeMap)
      .compose(dropRepeats())
      .filter(R.identity)

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
      error,
    })

    floor$.addListener({
      next(floor) {
        drawFloor(floor, { zoom })
      },
      error,
    })

    xs.combine(svg$, transform$).addListener({
      next([svg, transform]) {
        const { x, y, k } = transform
        svg.select('.board').attr('transform', `translate(${x},${y}) scale(${k})`)
      },
      error,
    })

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
        error,
      })

      const points$ = visiblePlainPoints$[traceName]
      const pointsWrapper$ = svg$.map(svg => getPlainPointsWrapper(svg, traceName))
      xs.combine(pointsWrapper$, points$).addListener({
        next([svg, points]) {
          drawPlainTracePoints(svg, points, getColor(traceName))
        },
        error,
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
            const pointsLayer = svg.select('*[data-layer=semantic-points]') as SVGSelection
            drawSemanticPoints(pointsLayer, traces, sIndex, (d: { sIndex: number }) =>
              listener.next(d.sIndex),
            )
          },
          error,
        })
      },
      stop() {},
    })

    xs.combine(svg$, visibleSemanticTraces$).addListener({
      next([svg, traces]) {
        const pathLayer = svg.select('*[data-layer=semantic-path]') as SVGSelection
        drawSemanticPath(pathLayer, traces)
      },
      error,
    })

    const tooltipTarget$ = xs
      .combine(sIndex$, dataSource$, floorId$)
      .map(([sIndex, dataSource, floorId]) => {
        const points = R.flatten<TracePoint>(
          dataSource.semanticTraces.filter(tr => tr.floor === floorId).map(tr => tr.data),
        )
        return points.find(p => p.sIndex === sIndex)
      })
      .compose(dropRepeats())

    xs.combine(legendState$.map(s => s.tooltip), tooltipTarget$, transform$).addListener({
      next: drawTooltip,
      error,
    })

    const mapCentralizeInfo$ = xs
      .merge(
        floor$.take(1).mapTo(false),
        resize$.compose(debounce(200)).mapTo(true),
        centralizeMap$.mapTo(true),
      )
      .compose(sampleCombine(svg$))
      .map(([useTransition, svg]) => {
        const regionLayer = svg.selectAll('*[data-layer=region]').node() as SVGGElement
        const contentBox = regionLayer.getBBox()
        return { useTransition, contentBox }
      })

    const traceCentralizeInfo$ = traceToCentralize$
      .compose(sampleCombine(svg$))
      .map(([trace, svg]) => {
        const traceNode = svg
          .select(`*[data-trace-index="${trace.traceIndex}"]`)
          .node() as SVGGElement
        const contentBox = traceNode.getBBox()
        if (contentBox.width === 0) {
          contentBox.width = 20
          contentBox.x -= 10
        }
        if (contentBox.height === 0) {
          contentBox.height = 20
          contentBox.y -= 10
        }
        return {
          useTransition: true,
          contentBox,
        }
      })

    xs
      .merge(mapCentralizeInfo$, traceCentralizeInfo$)
      .compose(sampleCombine(svg$))
      .addListener({
        next([{ useTransition, contentBox }, svg]) {
          const svgNode = svg.node() as SVGSVGElement
          const viewBox = { width: svgNode.clientWidth, height: svgNode.clientHeight }
          const padding = { top: 50, bottom: 50, left: 450, right: 360 }
          const targetTransform = doCentralize(contentBox, viewBox, padding)
          if (targetTransform) {
            if (useTransition) {
              zoom.transform(svg.transition(), targetTransform)
            } else {
              zoom.transform(svg, targetTransform)
            }
          }
        },
        error,
      })

    return xs.combine(nextSIndex$).map(([nextSIndex]) => ({
      nextSIndex,
    }))
  }
}
