import { makeDOMDriver } from '@cycle/dom'
import { makeHTTPDriver } from '@cycle/http'
// const { rerunner, restartable, isolate } = require('cycle-restart')
import App from './App'
import { run } from '@cycle/run'
import './styles/global.styl'
import { Stream } from 'xstream'
import { Thunk, Floor, DataSource } from './interfaces'
import makeDrawingDriver from './drivers/makeDrawingDriver'
import makeThunkDriver from './drivers/makeThunkDriver'
import makeFileDriver from './drivers/makeFileDriver'

run(App, {
  DOM: makeDOMDriver('#app'),
  drawing: makeDrawingDriver(),
  // HTTP: restartable(makeHTTPDriver()),
  thunk: makeThunkDriver(),
  file: makeFileDriver<DataSource>(),
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
