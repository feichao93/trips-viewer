import { Stream } from 'xstream'
import * as R from 'ramda'
import { DOMSource, h } from '@cycle/dom'
import { getColor, Mutation } from './utils'
import { VNode } from 'snabbdom/vnode'
import './styles/Legend.styl'

export interface Sources {
  state: Stream<State>
  DOM: DOMSource
}

export interface Sinks {
  DOM: Stream<VNode>
  mutation: Stream<Mutation<State>>
}

export interface State {
  groundTruth: boolean
  raw: boolean
  cleanedRaw: boolean
  semantic: boolean
  tooltip: boolean
}

interface CheckBoxProps {
  width?: number
  height?: number
  checked: boolean
  toggleKey: string
}

function Checkbox({ width = 16, height = 16, checked, toggleKey }: CheckBoxProps) {
  return h(
    'svg',
    {
      attrs: { width: `${width}px`, height, viewBox: '0 0 16 16' },
      dataset: { toggleKey },
    },
    [
      h('rect', {
        attrs: {
          fill: checked ? '#1881DC' : '#cccccc',
          x: 0,
          y: 0,
          width: 16,
          height: 16,
          rx: '2px',
        },
      }),
      checked
        ? h('path', {
            attrs: {
              d:
                'M11.6915897,5.28979659 C11.280376,4.90340114 10.6146515,4.90340114 10.2044894,5.28979659 L6.66657903,8.61418101 L5.79472179,7.79593181 C5.38455977,7.40953636 4.71883525,7.40953636 4.30762152,7.79593181 C3.89745949,8.18133904 3.89745949,8.80688462 4.30762152,9.19328008 L5.92302889,10.7102034 C6.33319092,11.0965989 6.99891544,11.0965989 7.41012916,10.7102034 L11.6915897,6.68714486 C12.1028034,6.30173763 12.1028034,5.67619204 11.6915897,5.28979659',
              fill: '#ffffff',
            },
          })
        : null,
    ].filter(R.identity),
  )
}

interface LegendItemProps {
  color: string
  displayName: string
  useCheckbox?: boolean
  checked?: boolean
  toggleKey?: string
  shape?: 'circle' | 'rect'
  borderColor?: string
}

const LegendItem = ({
  color,
  useCheckbox = true,
  checked,
  displayName,
  shape = 'circle',
  borderColor,
  toggleKey,
}: LegendItemProps) => (
  <div className="list-item">
    <button
      className="color"
      style={{
        background: color,
        border: borderColor ? `1px solid ${borderColor}` : 'none',
        borderRadius: shape === 'rect' ? '0' : '50%',
      }}
    />
    <div className="text">{displayName}</div>
    {useCheckbox ? <Checkbox checked={checked} toggleKey={toggleKey} /> : null}
  </div>
)

export default function Legend(sources: Sources): Sinks {
  const state$ = sources.state
  const mutation$ = sources.DOM.select('*[data-toggle-key]')
    .events('click')
    .map(e => (e.currentTarget as HTMLElement).dataset.toggleKey)
    .map(key => R.evolve({ [key]: R.not }))

  const vdom$ = state$.debug('state').map(state => (
    <div className="legend">
      <div className="title">Legend</div>
      <div className="list">
        <LegendItem
          displayName="Ground Truth"
          color={getColor('ground-truth')}
          checked={state.groundTruth}
          toggleKey="groundTruth"
        />
        <LegendItem
          displayName="Raw Data"
          color={getColor('raw')}
          checked={state.raw}
          toggleKey="raw"
        />
        <LegendItem
          displayName="Cleaned Raw Data"
          color={getColor('cleaned-raw')}
          checked={state.cleanedRaw}
          toggleKey="cleanedRaw"
        />
        <LegendItem
          displayName="Mobility Semantics"
          color={getColor('semantic')}
          checked={state.semantic}
          shape="rect"
          toggleKey="semantic"
        />
        <LegendItem
          displayName="Tooltip"
          color="rgba(0,0,0,0.6)"
          shape="rect"
          checked={state.tooltip}
          toggleKey="tooltip"
        />
        <LegendItem
          displayName="Room"
          useCheckbox={false}
          color="#f4f4f4"
          borderColor="#cccccc"
          shape="rect"
        />
        <LegendItem
          displayName="Hallway"
          useCheckbox={false}
          color="#ffffff"
          borderColor="#cccccc"
          shape="rect"
        />
        <LegendItem
          displayName="Staircase"
          useCheckbox={false}
          color="#d4eb8b"
          borderColor="#cccccc"
          shape="rect"
        />
        <div className="list-item">
          <button
            className="color"
            style={{
              background: '#a2a1a1',
              transform: 'scaleY(0.4)',
            }}
          />
          <div className="text">Door</div>
        </div>
        <div className="list-item">
          <svg width="16" height="16" className="color">
            <circle fill="#3078b3" cx="8" cy="8" r="8" />
            <line
              x1="3.34314"
              y1="3.34314"
              x2="12.65686"
              y2="12.65686"
              stroke="#f8f9fd"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="3.34314"
              y1="12.65686"
              x2="12.65686"
              y2="3.34314"
              stroke="#f8f9fd"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <div className="text">False Floor Values</div>
        </div>
      </div>
    </div>
  ))
  return {
    DOM: vdom$,
    mutation: mutation$,
  }
}
