import xs, { Stream } from 'xstream'
import * as d3 from 'd3'
import { RawTrace, RawTracePoint, SemanticTrace, TracePoint } from './interfaces'

export function foldFn<S>(state: S, f: Mutation<S>): S {
  return f(state)
}

export const noop = () => 0

export interface Mutation<S> {
  (old: S): S
}

export function redux<S>(initState: S, mutations$: Stream<Mutation<S>>) {
  return mutations$.fold(foldFn, initState)
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
