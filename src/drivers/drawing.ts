import * as d3 from 'd3'
import * as R from 'ramda'
import xs, { Stream } from 'xstream'
import dropRepeats from 'xstream/extra/dropRepeats'
import { MAX_SCALE, MIN_SCALE, plainTraceNameList } from '../constants'
import { State as LegendState } from '../Legend'
import {
  Floor,
  RawTrace,
  RawTracePoint,
  SemanticTrace,
  SVGSelection,
  TimeRange,
  TracePoint,
} from '../interfaces'
import {
  getColor,
  getPlainPointsLayerName,
  getPlainTraceLayerName,
  getRawTracePoints,
  stripPoints,
  formatTime,
} from '../utils'

export interface Env {
  zoom: d3.ZoomBehavior<SVGSVGElement, null>
}

export function getSvgFromFloor(floor: Floor) {
  return d3.select('svg.map') as d3.Selection<SVGSVGElement, null, null, null>
}

export function drawFloor(floor: Floor, env: Env) {
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

function pointRadius(pointType: string) {
  if (pointType === 'raw') {
    return 0.75
  } else if (pointType === 'pass-by') {
    return 1.25
  } else if (pointType === 'stay') {
    return 2
  } else {
    return 1
  }
}

export function drawSemanticPoints(
  layer: SVGSelection,
  traces: SemanticTrace[],
  sIndex: number,
  onClick: (d: { sIndex: number }) => void,
) {
  const pointGroupsJoin = layer
    .selectAll('.track-points')
    .data(traces, (tr: SemanticTrace) => String(tr.traceIndex))
  const pointGroups = pointGroupsJoin
    .enter()
    .append('g')
    .classed('track-points', true)
    .attr('data-trace-index', d => d.traceIndex)
    .merge(pointGroupsJoin)
  pointGroupsJoin.exit().remove()

  const trackPointOpacity = (d: { sIndex: number }) => (d.sIndex === sIndex ? 0.8 : 0.2)

  const symbolsJoin = pointGroups
    .selectAll('.symbol')
    .data(d => d.data, (p: TracePoint) => String(p.traceIndex))
  symbolsJoin
    .enter()
    .append('rect')
    .classed('symbol', true)
    .style('transition', 'opacity 250ms')
    .attr('fill', getColor('semantic'))
    .on('click', onClick)
    .style('cursor', 'pointer')
    .attr('x', p => p.x - pointRadius('stay'))
    .attr('y', p => p.y - pointRadius('stay'))
    .attr('width', 2 * pointRadius('stay'))
    .attr('height', 2 * pointRadius('stay'))
    .merge(symbolsJoin)
    .attr('opacity', trackPointOpacity)
  symbolsJoin.exit().remove()
}

export function drawSemanticPath(layer: SVGSelection, traces: SemanticTrace[]) {
  const pathJoin = layer
    .selectAll('path')
    .data(traces, (tr: SemanticTrace) => String(tr.traceIndex))

  pathJoin
    .enter()
    .append('path')
    .attr('fill', 'none')
    .attr('data-trace-index', tr => tr.traceIndex)
    .attr('stroke', getColor('semantic'))
    .attr('stroke-width', 0.4)
    .attr('d', trace => lineGenerator(trace.data))
    .attr('opacity', 1)
    .attr('stroke-dasharray', '1 1')
  pathJoin.exit().remove()
}

const lineGenerator = d3
  .line<RawTracePoint | TracePoint>()
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
    .attr('d', trace => lineGenerator(stripPoints(trace.data)))
    .attr('opacity', 0.8)
  join.exit().remove()
}

export function drawTooltip([show, target, transform]: [boolean, TracePoint, d3.ZoomTransform]) {
  const tooltipWrapper = d3.select('.tooltip-wrapper') as SVGSelection
  tooltipWrapper.style('left', `${transform.x}px`).style('top', `${transform.y}px`)
  if (show && target) {
    const x = transform.applyX(target.x) - transform.x
    const y = transform.applyY(target.y) - transform.y
    const verb = target.event === 'stay' ? 'stay around' : 'pass through'
    const preposition = target.startTime === target.endTime ? 'at' : 'during'
    tooltipWrapper.style('display', 'block').html(`
      <div style="left: ${x}px; top: ${y}px;">
        ${verb} <i>${target.regionName}</i>
        <br />
        ${preposition}
        ${formatTime(target.startTime * 1000)}
        ${target.endTime > target.startTime ? `-- ${formatTime(target.endTime)}` : ''}
      </div>
    `)
  } else {
    tooltipWrapper.style('display', 'none')
  }
}

export function getPlainPathWrapper(svg: SVGSelection, traceName: string) {
  return svg.select(`*[data-layer=${getPlainTraceLayerName(traceName)}]`) as SVGSelection
}

export function getPlainPointsWrapper(svg: SVGSelection, traceName: string) {
  return svg.select(`*[data-layer=${getPlainPointsLayerName(traceName)}]`) as SVGSelection
}
