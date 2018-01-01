import App from './App'
import makeDrawingDriver from './drivers/makeDrawingDriver'
import makeFileDriver from './drivers/makeFileDriver'
import makeShortcutDriver from './drivers/makeShortcutDriver'
import makeThunkDriver from './drivers/makeThunkDriver'
import { DataSource, Floor, Thunk } from './interfaces'
import { makeDOMDriver } from '@cycle/dom'
import { makeHTTPDriver } from '@cycle/http'
import { run } from '@cycle/run'
import { Stream } from 'xstream'
import './styles/global.styl'
// const { rerunner, restartable, isolate } = require('cycle-restart')

run(App, {
  DOM: makeDOMDriver('#app'),
  drawing: makeDrawingDriver(),
  // HTTP: restartable(makeHTTPDriver()),
  thunk: makeThunkDriver(),
  file: makeFileDriver<DataSource>(),
  shortcut: makeShortcutDriver(),
})

// const rerun = rerunner(setup, makeDrivers, isolate)

// rerun(App)
// rerun(App)

// declare const module: any
// if (module.hot) {
//   module.hot.accept('./App.tsx', () => {
//     const newViwer = require('./App.tsx').default
//     rerun(newViwer)
//   })
//   module.hot.accept()
// }
