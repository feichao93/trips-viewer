import * as R from 'ramda'
import * as d3 from 'd3'
import xs, { Stream } from 'xstream'
import { Floor, DataSource, TracePoint } from './interfaces'
import { noop, getTransformStream } from './utils'
import { DrawingSource, DrawingSink } from './App'
import { MIN_SCALE, MAX_SCALE } from './constants'

const dataSource: DataSource = require('../res/track.json')
const dataSource$ = xs.of(dataSource)

function getSvgFromFloor(floor: Floor) {
  return d3.select('svg.map') as d3.Selection<SVGSVGElement, null, null, null>
}

export default function makeDrawingDriver() {
  const zoom = d3.zoom() as d3.ZoomBehavior<SVGSVGElement, null>
  zoom.scaleExtent([MIN_SCALE, MAX_SCALE])
  const transform$ = getTransformStream(zoom)

  return function drawingDriver(sink: Stream<DrawingSink>) {
    const floor$ = sink.map(sink => sink.floor)

    const svg$ = floor$.map(getSvgFromFloor)

    svg$.take(1).addListener({
      next(svg) {
        svg.call(zoom)
      },
    })

    floor$.addListener({
      next(floor) {
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
          return floor.nodes
            .filter(node => node.labelConfig && node.labelConfig.show)
            .map(node => ({
              text: node.name,
              config: node.labelConfig,
            }))
        }
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

    xs.combine(svg$, dataSource$).addListener({
      next([svg, dataSource]) {
        const pointLayer = svg.select('*[data-layer=point]')

        const points = R.flatten<TracePoint>(dataSource.semanticTraces.map(tr => tr.data))

        const pointJoin = pointLayer.selectAll('circle').data(points)
        const point = pointJoin
          .enter()
          .append('circle')
          .attr('cx', d => d.x)
          .attr('cy', d => d.y)
          .attr('r', 0.5)
          .attr('fill', 'red')
          .merge(pointJoin)
        pointJoin.exit().remove()
      },
    })

    return xs.combine(xs.of(zoom), svg$, transform$).map(([zoom, svg, transform]) => ({
      selection: svg,
      zoom,
    }))
  }
}
