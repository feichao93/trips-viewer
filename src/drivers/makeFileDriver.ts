import xs, { Stream } from 'xstream'
import { DataSource } from '../interfaces'
import { preprocessData } from '../utils'

export default function makeFileDriver() {
  return function fileDriver(file$: Stream<File>) {
    return xs.create<{ filename: string; data: DataSource }>({
      start(listener) {
        file$.addListener({
          next(file) {
            const reader = new FileReader()
            reader.readAsText(file)
            reader.addEventListener('loadend', () => {
              try {
                const content: string = reader.result
                listener.next({
                  filename: file.name,
                  data: preprocessData(JSON.parse(content)),
                })
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
