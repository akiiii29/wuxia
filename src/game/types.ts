import type { Element, Technique } from './config'

export type Phase = 'title' | 'battle' | 'draft' | 'event' | 'dead'

export type Fighter = {
  hp: number
  maxHp: number
  qi: number
  maxQi: number
  atk: number
  def: number
  shield: number
}

export type Enemy = Fighter & {
  name: string
  sprite: string
  level: number
  boss: boolean
  burn: number
  poison: number
  frozen: number
}

export type SkillSlot = Technique & { cd: number; level: number }

export type CombatText = {
  id: number
  text: string
  side: 'hero' | 'enemy' | 'center'
  tone: 'damage' | 'heal' | 'crit' | 'status' | 'reward'
}

export type LogEntry = { id: number; text: string; element?: Element }

export type MetaState = {
  souls: number
  totalRuns: number
  bestFloor: number
  legacyAtk: number
  legacyHp: number
  legacySavvy: number
}

export type RunState = {
  phase: Phase
  floor: number
  level: number
  exp: number
  expNext: number
  stones: number
  tick: number
  tickProgress: number
  speed: number
  autoSkip: boolean
  root: { name: string; element: Element; bonus: string; detail: string }
  talent: { name: string; icon: string; detail: string }
  hero: Fighter
  enemy: Enemy
  skills: SkillSlot[]
  savvy: number
  crit: number
  critDmg: number
  lifesteal: number
  lastElement?: Element
  wetPrimed: boolean
  swordIntent: number
  treasures: string[]
  spirit: string
  combatTexts: CombatText[]
  logs: LogEntry[]
  draftChoices: Technique[]
  eventSeen: number
  muted: boolean
  flash: 'hero' | 'enemy' | 'none'
  shake: boolean
}
