import xs, { Stream } from 'xstream'
import * as d3 from 'd3'

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
  if (key === 'ground-truth') {
    return '#444444'
  } else if (key === 'raw') {
    return '#3078b3'
  } else if (key === 'cleaned-raw') {
    return '#7fc378'
  } else if (key === 'semantic') {
    return '#ffa726'
  } else if (key === 'semantic-stay') {
    return '#fb8c00'
  } else {
    throw new Error(`Invalid key ${key}`)
  }
}
