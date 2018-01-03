import * as d3 from 'd3'
import xs from 'xstream'
import { DataSource, RawTrace, RawTracePoint, SemanticTrace, TracePoint } from './interfaces'

export function foldFn<S>(state: S, f: Mutation<S>): S {
  return f(state)
}

export interface Mutation<S> {
  (old: S): S
}

export function getTransformStream<A extends Element, B>(zoom: d3.ZoomBehavior<A, B>) {
  return xs.create<d3.ZoomTransform>({
    start(listener) {
      zoom.on('zoom', () => listener.next(d3.event.transform))
    },
    stop() {
      zoom.on('zoom', null)
    },
  })
}

/** 获取 key 对应的颜色 */
export function getColor(key: string) {
  if (key === 'ground-truth' || key === 'groundTruth') {
    return '#444444'
  } else if (key === 'raw') {
    return '#3078b3'
  } else if (key === 'cleaned-raw' || key === 'cleanedRaw') {
    return '#7fc378'
  } else if (key === 'semantic') {
    return '#ffa726'
  } else if (key === 'semantic-stay') {
    return '#fb8c00'
  } else {
    throw new Error(`Invalid key ${key}`)
  }
}

export function getRawTracePoints(traces: RawTrace[]): RawTracePoint[] {
  return traces.reduce<RawTracePoint[]>((ps, trace) => ps.concat(trace.data), [])
}
export function getSemanticTracePoints(traces: SemanticTrace[]): TracePoint[] {
  return traces.reduce<TracePoint[]>((ps, tr) => ps.concat(tr.data), [])
}

export function formatTime(t: number) {
  const date = new Date(t)
  const hour = date.getHours()
  const hourStr = hour >= 10 ? String(hour) : `0${hour}`
  const minute = date.getMinutes()
  const minuteStr = minute >= 10 ? String(minute) : `0${minute}`
  const second = date.getSeconds()
  const secondStr = second >= 10 ? String(second) : `0${second}`
  return `${hourStr}:${minuteStr}:${secondStr}`
}

export function getPlainPointsLayerName(name: string) {
  return `plain-points-${name}`
}

export function getPlainTraceLayerName(name: string) {
  return `plain-trace-${name}`
}

export function getTrace([sIndex, { semanticTraces: traces }]: [number, DataSource]) {
  let t = 0
  for (let i = 0; i < traces.length; i++) {
    const trace = traces[i]
    t += trace.data.length
    if (t > sIndex) {
      return trace
    }
  }
  throw new Error(`Invalid sIndex ${sIndex}`)
}

export const thunk = {
  tryToScroll(selector: string) {
    return () => {
      const node: any = document.querySelector(selector)
      if (node) {
        node.scrollIntoViewIfNeeded()
      }
    }
  },
  click(selector: string) {
    return () => {
      const node: HTMLElement = document.querySelector(selector)
      node.click()
    }
  },
}

/** Add traceIndex property to Trace and add sIndex to TracePoint. */
export function preprocessData(dataSource: DataSource) {
  let startSIndex = 0
  dataSource.semanticTraces.forEach((trace, i) => {
    trace.traceIndex = i
    trace.data.forEach((p, j) => {
      p.traceIndex = i
      p.sIndex = startSIndex + j
    })
    startSIndex += trace.data.length
  })

  return dataSource
}

/** Remove unneccessary points to draw a path */
export function stripPoints(points: RawTracePoint[], threshhold = 4): RawTracePoint[] {
  const result: RawTracePoint[] = []
  for (const p of points) {
    const last = result[result.length - 1]
    if (last == null) {
      result.push(p)
    } else {
      const distance = Math.abs(p.x - last.x) + Math.abs(p.y - last.y)
      if (distance >= threshhold) {
        result.push(p)
      }
    }
  }
  return result
}
