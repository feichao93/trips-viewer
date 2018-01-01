import { DOMSource } from '@cycle/dom'
import xs, { Stream } from 'xstream'
import { VNode } from 'snabbdom/vnode'
import './styles/ButtonGroup.styl'
import * as R from 'ramda'
import { Thunk } from './interfaces'

export interface Sources {
  DOM: DOMSource
  filename: Stream<string>
}

export interface Sinks {
  DOM: Stream<VNode>
  thunk: Stream<Thunk>
  file: Stream<File>
}

export default function ButtonGroup({ DOM: domSource$, filename: filename$ }: Sources): Sinks {
  const thunk$ = domSource$
    .select('.open-file-button')
    .events('click')
    .mapTo(() => {
      const fileInput: HTMLInputElement = document.querySelector('input[type=file]')
      fileInput.click()
    })
  const file$ = domSource$
    .select('input[type=file]')
    .events('change')
    .map(e => (e.target as HTMLInputElement).files[0])
    .filter(R.identity)

  const vdom$ = xs.combine(filename$).map(([filename]) => (
    <div className="button-group-widget">
      <p className="filename">
        Current Filename: <b>{filename}</b>
      </p>
      <div className="buttons-wrapper">
        <button className="reset-transform-button">Centralize Map</button>
        <button className="open-file-button">Open Tracks</button>
      </div>
      <input type="file" style={{ display: 'none' }} />
    </div>
  ))

  return {
    DOM: vdom$,
    thunk: thunk$,
    file: file$,
  }
}
