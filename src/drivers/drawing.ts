import * as d3 from 'd3'
import * as R from 'ramda'
import dropRepeats from 'xstream/extra/dropRepeats'
import sampleCombine from 'xstream/extra/sampleCombine'
import xs, { Stream } from 'xstream'
import { Floor, RawTrace, RawTracePoint, TimeRange, TracePoint } from '../interfaces'
import { getColor, getRawTracePoints } from '../utils'
import { MAX_SCALE, MIN_SCALE, plainTraceNameList } from '../constants'
import { State as LegendState } from '../Legend'

export interface Env {
  zoom: d3.ZoomBehavior<SVGSVGElement, null>
}

export function getSvgFromFloor(floor: Floor) {
  return d3.select('svg.map') as d3.Selection<SVGSVGElement, null, null, null>
}

export function drawFloor(floor: Floor, resetTransform: boolean, env: Env) {
  const svg = getSvgFromFloor(floor)
  const regionLayer = svg.select('*[data-layer=region]')
  const regionJoin = regionLayer.selectAll('polygon').data(floor.regions)
  regionJoin
    .enter()
    .append('polygon')
    .merge(regionJoin)
    .attr('fill', d => floor.config.colors[d.color])
    .attr('points', d => d.points.map(p => `${p.x},${p.y}`).join(' '))
    .attr('stroke', '#cccccc')
    .attr('stroke-width', 0.2)
  regionJoin.exit().remove()

  const doorLayer = svg.select('*[data-layer=door]')
  const doorJoin = doorLayer.selectAll('line').data(floor.doors)
  doorJoin
    .enter()
    .append('line')
    .merge(doorJoin)
    .attr('stroke', '#a2a1a1')
    .attr('x1', d => d.line.x1)
    .attr('y1', d => d.line.y1)
    .attr('x2', d => d.line.x2)
    .attr('y2', d => d.line.y2)
    .attr('stroke-width', 0.3)
  doorJoin.exit().remove()

  const textLayer = svg.select('*[data-layer=text]')
  const textJoin = textLayer.selectAll('text').data(getAllLabelConfig)
  textJoin
    .enter()
    .append('text')
    .merge(textJoin)
    .text(d => d.text)
    .attr('x', d => d.config.pos.x)
    .attr('y', d => d.config.pos.y + 1)
    .attr('font-size', 1.2)
    .attr('fill', '#666')
  textJoin.exit().remove()

  function getAllLabelConfig() {
    return floor.nodes.filter(node => node.labelConfig && node.labelConfig.show).map(node => ({
      text: node.name,
      config: node.labelConfig,
    }))
  }

  if (resetTransform) {
    const node = regionLayer.node() as SVGGElement
    const contentBox = node.getBBox()
    const padding = { top: 50, bottom: 50, left: 450, right: 360 }
    const svgNode = svg.node()
    const viewBox = { width: svgNode.clientWidth, height: svgNode.clientHeight }
    const targetTransform = doCentralize(contentBox, viewBox, padding)
    if (targetTransform) {
      env.zoom.transform(svg, targetTransform)
    }
  }
}

export interface Padding {
  left: number
  right: number
  top: number
  bottom: number
}
export function doCentralize(contentBox: SVGRect, viewport: Partial<SVGRect>, padding: Padding) {
  if (contentBox.width === 0) {
    contentBox.width = 200
    contentBox.x -= 100
  }
  if (contentBox.height === 0) {
    contentBox.height = 200
    contentBox.y -= 100
  }
  if (contentBox.width && contentBox.height) {
    const viewBox = {
      x: padding.left,
      y: padding.top,
      width: viewport.width - padding.left - padding.right,
      height: viewport.height - padding.top - padding.bottom,
    }
    const mb = {
      x: contentBox.x,
      y: contentBox.y,
      width: contentBox.width,
      height: contentBox.height,
    }
    const scaleX = viewBox.width / mb.width
    const scaleY = viewBox.height / mb.height
    const scale = R.clamp(MIN_SCALE, MAX_SCALE, Math.min(scaleX, scaleY))
    const dx = viewBox.x + viewBox.width / 2 - (mb.x + mb.width / 2) * scale
    const dy = viewBox.y + viewBox.height / 2 - (mb.y + mb.height / 2) * scale
    return d3.zoomIdentity.translate(dx, dy).scale(scale)
  } else {
    return null
  }
}

export function getVisiblePlainPoints(
  plainTraces$: { [key: string]: Stream<RawTrace[]> },
  legendState$: Stream<LegendState>,
  floorId$: Stream<number>,
  timeRange$: Stream<TimeRange>,
) {
  const result$: { [key: string]: Stream<RawTracePoint[]> } = {}
  for (const traceName of plainTraceNameList) {
    result$[traceName] = xs
      .combine(plainTraces$[traceName], legendState$, floorId$, timeRange$)
      .map(([traces, visibility, floorId, timeRange]) => {
        function inTimeRange(p: RawTracePoint) {
          return timeRange.start <= p.time && p.time <= timeRange.end
        }
        if ((visibility as any)[traceName]) {
          const tracesInThisFloor = traces.filter(tr => tr.floor === String(floorId))
          return getRawTracePoints(tracesInThisFloor).filter(inTimeRange)
        } else {
          return []
        }
      })
      .compose(dropRepeats(R.equals))
  }
  return result$
}

export function getVisiblePlainTraces(
  plainTraces$: { [key: string]: Stream<RawTrace[]> },
  legendState$: Stream<LegendState>,
  floorId$: Stream<number>,
) {
  const result$: { [key: string]: Stream<RawTrace[]> } = {}
  for (const traceName of plainTraceNameList) {
    result$[traceName] = xs
      .combine(plainTraces$[traceName], legendState$, floorId$)
      .map(([traces, visibility, floorId]) => {
        return (visibility as any)[traceName]
          ? traces.filter(tr => Number(tr.floor) === floorId)
          : []
      })
  }
  return result$
}

export function drawPlainTracePoints(
  wrapper: d3.Selection<SVGElement, null, null, null>,
  points: RawTracePoint[],
  color: string,
) {
  const join = wrapper.selectAll('circle').data(points, (p: RawTracePoint) => String(p.time))
  join
    .enter()
    .append('circle')
    .attr('opacity', 0.8)
    .attr('fill', color)
    .attr('cx', p => p.x)
    .attr('cy', p => p.y)
    .attr('r', 0)
    .transition()
    .delay((_, i) => 50 * i)
    .attr('r', 0.75)
  join.exit().remove()
}

const lineGenerator = d3
  .line<RawTracePoint>()
  .x(item => item.x)
  .y(item => item.y)
  .curve(d3.curveCardinal.tension(0.7))
export function drawPlaintracePaths(
  wrapper: d3.Selection<SVGElement, null, null, null>,
  traces: RawTrace[],
  color: string,
) {
  const join = wrapper.selectAll('path').data(traces)
  join
    .enter()
    .append('path')
    .merge(join)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 0.3)
    .attr('d', trace => lineGenerator(trace.data))
    .attr('opacity', 0.8)
  join.exit().remove()
}
