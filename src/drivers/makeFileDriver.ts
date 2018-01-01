import xs, { Stream } from 'xstream'
import { Driver } from '@cycle/run'

export default function makeFileDriver<T>(): Driver<Stream<File>, Stream<T>> {
  return function fileDriver(file$: Stream<File>) {
    return xs.create({
      start(listener) {
        file$.addListener({
          next(file) {
            const reader = new FileReader()
            reader.readAsText(file)
            reader.addEventListener('loadend', () => {
              try {
                const content: string = reader.result
                listener.next(JSON.parse(content) as T)
              } catch (e) {
                listener.error(e)
              }
            })
          },
        })
      },
      stop() {},
    })
  }
}
