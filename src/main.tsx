import { makeDOMDriver } from '@cycle/dom'
import { makeHTTPDriver } from '@cycle/http'
// const { rerunner, restartable, isolate } = require('cycle-restart')
import App from './App'
import makeDrawingDriver from './makeFloorDriver'
import { run } from '@cycle/run'

run(App, {
  DOM: makeDOMDriver('#app'),
  drawing: makeDrawingDriver(),
  // HTTP: restartable(makeHTTPDriver()),
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
