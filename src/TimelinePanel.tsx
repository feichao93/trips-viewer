import * as d3 from 'd3'
import sampleCombine from 'xstream/extra/sampleCombine'
import xs, { Stream } from 'xstream'
import { DOMSource } from '@cycle/dom'
import { formatTime, getColor, getSemanticTracePoints, thunk } from './utils'
import { ShortcutSource } from './drivers/makeShortcutDriver'
import { SemanticTrace, Thunk, TracePoint } from './interfaces'
import { VNode } from 'snabbdom/vnode'
import './styles/TimelinePanel.styl'
import { getNameFromId } from '../res/rules'

export interface Sources {
  DOM: DOMSource
  sIndex: Stream<number>
  semanticTraces: Stream<SemanticTrace[]>
  shortcut: ShortcutSource
}

export interface Sinks {
  nextSIndex: Stream<number>
  DOM: Stream<VNode>
  thunk: Stream<Thunk>
}

function TrackPointText({ point: p }: { point: TracePoint }) {
  return (
    <p>
      <b>{`${Math.floor(p.roomID / 141) + 1}F ${getNameFromId(p.roomID)}`}</b>
      <br />
      {formatTime(p.startTime * 1000)}
      {p.endTime > p.startTime ? `-- ${formatTime(p.endTime * 1000)}` : ''}
    </p>
  )
}

export default function TimelinePanel(sources: Sources): Sinks {
  const domSource = sources.DOM
  const points$ = sources.semanticTraces.map(getSemanticTracePoints)
  const sIndex$ = sources.sIndex
  const h = d3
    .scaleLinear()
    .domain([0, 1])
    .range([40, 40])

  const gap = 10

  const clickToNextSIndex$ = domSource
    .select('.list .item')
    .events('click')
    .map(e => Number((e.currentTarget as HTMLElement).dataset.sIndex))

  const keyboard$ = xs.merge(
    sources.shortcut.shortcut(['s', 'down'], 'next'),
    sources.shortcut.shortcut(['w', 'up'], 'prev'),
  )

  const keyboardToNextSIndex$ = keyboard$
    .compose(sampleCombine(sIndex$, points$))
    .map(([short, sIndex, points]) => {
      if (short === 'next') {
        return Math.min(sIndex + 1, points.length - 1)
      } else {
        return Math.max(sIndex - 1, 0)
      }
    })

  const vdom$ = xs.combine(points$, sIndex$).map(([points, sIndex]) => (
    <div className="timeline-panel">
      <h1 className="title">Mobility Semantics Timeline</h1>
      <div className="timeline-legend">
        <span
          className="cell"
          style={{
            background: '#f18a2a',
            transform: 'scale(0.65)',
            fontSize: '32px',
            lineHeight: '37px',
          }}
        >
          ∥
        </span>
        <span className="text">stay</span>
        <span
          className="cell"
          style={{
            background: '#f7a53d',
            transform: 'scale(0.65)',
            fontSize: '18px',
            lineHeight: '40px',
          }}
        >
          ▶
        </span>
        <span className="text">pass-by</span>
      </div>
      <div className="content">
        <div className="list">
          {points.map(p => (
            <div
              className="item"
              data-sIndex={String(p.sIndex)}
              style={{
                marginTop: gap + 'px',
                height: `${h(p.endTime - p.startTime)}px`,
                cursor: 'pointer',
              }}
            >
              {p.sIndex === sIndex ? (
                <svg width="20" height="40" style={{ display: 'block', position: 'absolute' }}>
                  <path fill="#ff5447" d="M0,10 L20,20 L0,30 Z" />
                </svg>
              ) : null}
              <div className="item-symbol-wrapper">
                <div
                  className={['item-symbol', p.event].join(' ')}
                  style={{
                    backgroundColor: getColor(p.event === 'stay' ? 'semantic-stay' : 'semantic'),
                  }}
                >
                  {p.event === 'stay' ? '∥' : '▶'}
                </div>
              </div>
              <TrackPointText point={p} />
            </div>
          ))}
        </div>
      </div>
    </div>
  ))

  return {
    DOM: vdom$,
    nextSIndex: xs.merge(clickToNextSIndex$, keyboardToNextSIndex$),
    thunk: sIndex$.map(sIndex => `.item[data-s-index='${sIndex}']`).map(thunk.tryToScroll),
  }
}
