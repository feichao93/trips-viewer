import { Floor } from '../src/interfaces'

declare global {
  interface NodeRequire {
    context: any
  }
}
const requireFloor = require.context('./', false, /floor-\d+\.json/)

const floors: Floor[] = []
requireFloor.keys().forEach((key: string) => {
  floors.push(requireFloor(key))
})

export default floors
