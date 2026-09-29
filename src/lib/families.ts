// 计分关系模型：
// - 族内是「上下位」：层级语义为「存在至少该规模」，因此强级一定蕴含弱级（A ⇒ B，B 为 A 的下位）。
// - 族间默认互相独立；只有严格的跨族蕴含才写进 EXTRA_COVERS。
// - 组合奇遇（combo）是独立的加成层，不参与上下位压制。
export interface Family {
  id: string
  name: string
  /** 由弱到强；同一级可以放多个互斥结构（例如左右镜像与上下镜像）。 */
  levels: readonly (readonly string[])[]
}

export const FAMILIES: readonly Family[] = [
  { id: 'cross-forward', name: '正向十字族', levels: [['cross-forward-5'], ['cross-forward-9'], ['cross-forward-13']] },
  { id: 'cross-x', name: '斜向十字族', levels: [['cross-x-5'], ['cross-x-9'], ['cross-x-13']] },
  { id: 'solid', name: '实心方块族', levels: [['solid-2'], ['crystal-square'], ['solid-4'], ['solid-5'], ['solid-6'], ['solid-7'], ['solid-8']] },
  { id: 'frame', name: '空心方框族', levels: [['amber-window'], ['frame-4'], ['frame-5'], ['frame-6'], ['frame-7'], ['frame-8']] },
  { id: 'lines', name: '平行贯穿族', levels: [['span'], ['parallel-veins'], ['lines-3'], ['lines-4']] },
  { id: 'grid', name: '十字贯穿族', levels: [['cross'], ['grid-2'], ['grid-3']] },
  { id: 'mirror', name: '镜像族', levels: [['mirror-x', 'mirror-y'], ['double-mirror'], ['eightfold']] },
  { id: 'diagonal', name: '对角镜像族', levels: [['diagonal-main', 'diagonal-anti']] },
  { id: 'rotation', name: '回转族', levels: [['half-turn'], ['rotation']] },
  { id: 'holes', name: '空洞数量族', levels: [['cavities'], ['holes-3']] },
  { id: 'isolated', name: '孤立像素族', levels: [['single-pebble'], ['stardust'], ['string-of-pearls']] },
  { id: 'pairs', name: '双格块族', levels: [['paired-pebble'], ['domino']] },
  { id: 'equal-fragments', name: '等重碎片族', levels: [['equal-fragments'], ['twin-isles'], ['triplets']] },
  { id: 'single-body', name: '一体遗存族', levels: [['connected'], ['living-thread']] },
]

// 跨族严格蕴含：键为上位结构，值为它在命中时压制的下位结构。
export const EXTRA_COVERS: Readonly<Record<string, readonly string[]>> = {
  'little-cross': ['cross-forward-5'],
  saltire: ['cross-x-5'],
  eightfold: ['double-mirror', 'diagonal-main', 'diagonal-anti', 'half-turn'],
  'double-mirror': ['half-turn'],
  cross: ['span'],
  'grid-2': ['parallel-veins'],
  'grid-3': ['parallel-veins'],
  pinhole: ['holes-3'],
}

function buildCoveredBy(): Map<string, string[]> {
  const covered = new Map<string, string[]>()
  const add = (lower: string, upper: string) => {
    const list = covered.get(lower)
    if (list) list.push(upper)
    else covered.set(lower, [upper])
  }
  for (const family of FAMILIES) {
    family.levels.forEach((level, strong) => {
      family.levels.slice(0, strong).forEach(weaker => weaker.forEach(lower => level.forEach(upper => add(lower, upper))))
    })
  }
  for (const [upper, lowers] of Object.entries(EXTRA_COVERS)) lowers.forEach(lower => add(lower, upper))
  return covered
}

/** 下位结构 → 能压制它的上位结构列表。 */
export const COVERED_BY: ReadonlyMap<string, string[]> = buildCoveredBy()
