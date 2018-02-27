import { Floor } from '../src/interfaces'
import { preprocessFloors } from './rules'

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

preprocessFloors(floors)

export default floors
