import { Floor } from '../src/interfaces'

const t = (x: number) => (x < 10 ? '0' + x : String(x))

type RuleFn = (x: number, y: number) => string

type Rules = ([number, RuleFn] | [number, number, RuleFn] | [number, number, number, RuleFn])[]

const rules: Rules = [
  [0, (x, y) => `warehouse-${y}01`],
  [1, 5, (x, y) => `W-${y}${t(x)}`], // W-1 ~ W-5
  [6, 10, (x, y) => `N-${y}${t(x - 5)}`], // N-1 ~ N-5
  [11, 18, (x, y) => `shop-${y}${t(x - 10)}`], // shop-1 ~ shop-8
  [19, (x, y) => `hallway-${y}01`], // hallway-1
  [20, 22, (x, y) => `shop-${y}${t(x - 11)}`], // shop-9 ~ shop-11
  [23, (x, y) => `hallway-${y}02`], // hallway-2
  [24, 25, (x, y) => `shop-${y}${t(x - 12)}`], // shop-12 ~ shop-13
  [26, 31, (x, y) => `hallway-${y}${t(x - 23)}`], // H-3 ~ H-8
  [32, 34, (x, y) => `warehouse-${y}${t(x - 30)}`], // W-2 ~ W-4
  [35, 47, 3, (x, y) => `E-${y}${t((x - 35) / 3 + 1)}`], // E-1 ~ E-5
  [36, 48, 3, (x, y) => `W-${y}${t((x - 36) / 3 + 6)}`], // W-6 ~ W-10
  [37, 49, 3, (x, y) => `E-${y}${t((x - 37) / 3 + 6)}`], // E-6 ~ E-10
  [50, 62, 3, (x, y) => `N-${y}${t((x - 50) / 3 + 6)}`], // N-6 ~ N-10
  [51, 63, 3, (x, y) => `S-${y}${t((x - 51) / 3 + 1)}`], // S-1 ~ S-5
  [52, 64, 3, (x, y) => `S-${y}${t((x - 52) / 3 + 6)}`], // S-6 ~ S-10
  [65, 86, 3, (x, y) => `shop-${y}${t((x - 65) / 3 + 14)}`], // shop-14 ~ shop-21
  [66, 87, 3, (x, y) => `shop-${y}${t((x - 66) / 3 + 22)}`], // shop-22 ~ shop-29
  [67, 88, 3, (x, y) => `shop-${y}${t((x - 67) / 3 + 30)}`], // shop-30 ~ shop-37
  [89, 91, (x, y) => `hallway-${y}${t(x - 80)}`], // hallway-9 ~ hallway-11
  [101, (x, y) => `hallway-${y}${t(x - 101 + 12)}`], // hallway-12
  [102, (x, y) => `hallway-${y}${t(x - 102 + 13)}`], // hallway-13
  [103, (x, y) => `hallway-${y}${t(x - 103 + 14)}`], // hallway-14
  [92, 107, 3, (x, y) => `shop-${y}${t((x - 92) / 3 + 38)}`], // shop-38 ~ shop-43
  [93, 108, 3, (x, y) => `shop-${y}${t((x - 93) / 3 + 44)}`], // shop-44 ~ shop-49
  [94, 109, 3, (x, y) => `shop-${y}${t((x - 94) / 3 + 50)}`], // shop-50 ~ shop-55
  [110, 125, 3, (x, y) => `hallway-${y}${t((x - 110) / 3 + 15)}`], // hallway-15 ~ hallway-20
  [111, 126, 3, (x, y) => `hallway-${y}${t((x - 111) / 3 + 21)}`], // hallway-21 ~ hallway-26
  [112, 127, 3, (x, y) => `hallway-${y}${t((x - 112) / 3 + 27)}`], // hallway-27 ~ hallway-32
  [128, (x, y) => `staircase-W`],
  [129, (x, y) => `staircase-N`],
  [130, (x, y) => `staircase-S`],
  [131, (x, y) => `staircase-E`],
  [132, 140, (x, y) => `C-${y}${t(x - 132 + 1)}`], // C-1 ~ C-9
]

export function getRule(index: number) {
  for (const rule of rules) {
    if (rule.length === 2) {
      if (rule[0] === index) {
        return rule[1]
      }
    } else if (rule.length === 3) {
      if (rule[0] <= index && index <= rule[1]) {
        return rule[2]
      }
    } else {
      const [start, end, step, fn] = rule
      if (start <= index && index <= end && (index - start) % step === 0) {
        return fn
      }
    }
  }
  throw new Error('not found for index ' + index)
}

const cache = new Map<number, string>()

export function getNameFromId(id: number) {
  if (!cache.has(id)) {
    const rule = getRule(id % 141)
    cache.set(id, rule(id % 141, Math.floor(id / 141)))
  }
  return cache.get(id)
}

export function preprocessFloors(floors: Floor[]) {
  floors.forEach(flr => {
    flr.nodes.forEach(node => {
      const ruleFn = getRule(node.id % 141)
      node.name = ruleFn(node.id % 141, Math.floor(node.id / 141))
    })
  })
}

export const notShowIdArray = [
  26,
  110,
  19,
  89,
  23,
  101,
  132,
  139,
  134,
  137,
  90,
  91,
  111,
  112,
  102,
  103,
  94,
  97,
  27,
  28,
  117,
  114,
  113,
  116,
  118,
  115,
  24,
  25,
  108,
  105,
  20,
  21,
  95,
  92,
  93,
  96,
  104,
  107,
  106,
  109,
]
