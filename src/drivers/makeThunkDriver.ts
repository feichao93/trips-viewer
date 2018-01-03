import { Stream } from 'xstream'
import { Thunk } from '../interfaces'

export default function makeThunkDriver() {
  return function thunkDriver(thunk$: Stream<Thunk>) {
    thunk$.addListener({
      next(thunk) {
        thunk()
      },
      error(e) {
        throw e
      },
    })
  }
}
