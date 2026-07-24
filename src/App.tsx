import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ASSETS } from './assets'
import { audio } from './engine/audio'
import { ELEMENTS, META_KEY, ROOTS, SPEEDS, TALENTS, TECHNIQUES, type Element, type Technique } from './game/config'
import type { Enemy, MetaState, RunState, SkillSlot } from './game/types'

const DEFAULT_META: MetaState = { souls: 0, totalRuns: 0, bestFloor: 0, legacyAtk: 0, legacyHp: 0, legacySavvy: 0 }
const ENEMY_VARIANTS = [
  { name: 'Hắc Phong Lang', sprite: ASSETS.quaiHacPhongLang },
  { name: 'U Minh Xà', sprite: ASSETS.quaiUMinhXa },
  { name: 'Thiết Giáp Khôi', sprite: ASSETS.quaiThietGiapKhoi },
  { name: 'Xích Diễm Điểu', sprite: ASSETS.quaiXichDiemDieu },
]
const SPIRIT_VARIANTS = [
  { name: 'Hỏa Hồ', sprite: ASSETS.hoaHo },
  { name: 'Bạch Hổ Linh Thú', sprite: ASSETS.linhThuBachHo },
  { name: 'Huyền Vũ Linh Thú', sprite: ASSETS.linhThuHuyenVu },
  { name: 'Thanh Loan Linh Thú', sprite: ASSETS.linhThuThanhLuan },
]
let nextId = 1

function pick<T>(list: T[]): T { return list[Math.floor(Math.random() * list.length)] }
function sample<T>(list: T[], count: number): T[] { return [...list].sort(() => Math.random() - .5).slice(0, count) }
function enemyFor(floor: number): Enemy {
  const boss = floor % 5 === 0
  const level = Math.max(1, floor + Math.floor(floor / 3))
  const hp = Math.round((boss ? 580 : 230) * Math.pow(1.16, floor - 1))
  const variant = boss ? pick([...ENEMY_VARIANTS, { name: 'Lôi Long', sprite: ASSETS.loiLong }]) : ENEMY_VARIANTS[(floor - 1) % ENEMY_VARIANTS.length]
  return {
    name: boss ? `${variant.name} Yêu Vương` : variant.name,
    sprite: variant.sprite,
    level, boss, hp, maxHp: hp, qi: 0, maxQi: 0,
    atk: Math.round((boss ? 36 : 20) * Math.pow(1.1, floor - 1)),
    def: Math.round((boss ? 18 : 8) * Math.pow(1.08, floor - 1)),
    shield: 0, burn: 0, poison: 0, frozen: 0,
  }
}
function loadMeta(): MetaState {
  try { return { ...DEFAULT_META, ...JSON.parse(localStorage.getItem(META_KEY) || '{}') } }
  catch { return DEFAULT_META }
}
function initialRun(meta: MetaState): RunState {
  const root = pick(ROOTS)
  const talent = pick(TALENTS)
  const spirit = pick(SPIRIT_VARIANTS)
  const first = TECHNIQUES.find(t => t.element === root.element) || TECHNIQUES[0]
  return {
    phase: 'title', floor: 1, level: 1, exp: 0, expNext: 55, stones: 0, tick: 0, tickProgress: 0,
    speed: 1, autoSkip: false, root, talent,
    hero: { hp: 620 + meta.legacyHp * 55, maxHp: 620 + meta.legacyHp * 55, qi: talent.name === 'Đạo Pháp Tự Nhiên' ? 50 : 40, maxQi: 100, atk: 68 + meta.legacyAtk * 7, def: Math.round(22 * (root.element === 'tho' ? 1.15 : 1)), shield: 0 },
    enemy: enemyFor(1), skills: [{ ...first, cd: 0, level: 1 }],
    savvy: 12 + meta.legacySavvy * 3 + (talent.name === 'Đạo Pháp Tự Nhiên' ? 18 : 0), crit: .14, critDmg: 1.65 * (root.element === 'kim' ? 1.15 : 1),
    lifesteal: talent.name === 'Bách Độc Bất Xâm' ? .05 : .02, swordIntent: 0, wetPrimed: false, wetTicks: 0,
    treasures: [], spirit: spirit.name, combatTexts: [], logs: [{ id: nextId++, text: `Linh căn thức tỉnh: ${root.name}`, element: root.element }],
    draftChoices: [], eventSeen: 0, muted: false, flash: 'none', shake: false,
  }
}

function float(text: string, side: 'hero' | 'enemy' | 'center', tone: 'damage' | 'heal' | 'crit' | 'status' | 'reward') {
  return { id: nextId++, text, side, tone }
}
function log(text: string, element?: Element) { return { id: nextId++, text, element } }

function beginBattle(s: RunState, enemy = enemyFor(s.floor)): RunState {
  const hero = { ...s.hero }
  if (s.root.element === 'tho') hero.shield = Math.max(hero.shield, Math.round(hero.maxHp * .1))
  return { ...s, phase: 'battle', hero, enemy, tickProgress: 0, wetPrimed: false, wetTicks: 0 }
}

function resolveTick(prev: RunState): RunState {
  if (prev.phase !== 'battle') return prev
  const s: RunState = {
    ...prev,
    tick: prev.tick + 1,
    tickProgress: 0,
    hero: { ...prev.hero },
    enemy: { ...prev.enemy },
    skills: prev.skills.map(sk => ({ ...sk, cd: Math.max(0, sk.cd - 1) })),
    combatTexts: [],
    logs: [...prev.logs].slice(-7),
    flash: 'none', shake: false,
  }
  const wasWet = prev.wetPrimed
  s.wetTicks = Math.max(0, prev.wetTicks - 1)
  s.wetPrimed = s.wetTicks > 0
  const qiRegen = 8 + Math.floor(s.savvy / 15) + (s.root.element === 'thuy' ? 3 : 0)
  s.hero.qi = Math.min(s.hero.maxQi, s.hero.qi + qiRegen)
  if (s.hero.shield > 0) s.hero.shield = Math.max(0, s.hero.shield - 4)

  if (s.enemy.burn > 0) {
    const dot = Math.round(s.hero.atk * .14 * s.enemy.burn * (s.root.element === 'hoa' ? 1.3 : 1))
    s.enemy.hp -= dot; s.enemy.burn--; s.combatTexts.push(float(`-${dot} 🔥`, 'enemy', 'status'))
    if (s.treasures.includes('phoenix-vase')) s.hero.qi = Math.min(s.hero.maxQi, s.hero.qi + 5)
  }
  if (s.enemy.poison > 0) {
    const dot = Math.round((s.hero.atk * .1 + (s.root.element === 'moc' ? s.enemy.maxHp * .02 : 0)) * s.enemy.poison)
    s.enemy.hp -= dot; s.enemy.poison--; s.combatTexts.push(float(`-${dot} ☠`, 'enemy', 'status'))
  }

  const ready = s.skills.find(sk => sk.cd === 0 && s.hero.qi >= sk.qi)
  if (ready) {
    const idx = s.skills.findIndex(sk => sk.id === ready.id)
    let power = ready.power * (1 + (ready.level - 1) * .18)
    let synergy = ''
    if (wasWet && ready.element === 'moc') { power *= 1.5; s.wetPrimed = false; s.wetTicks = 0; synergy = 'THỦY SINH MỘC!' }
    const steamDamage = wasWet && ready.element === 'hoa' ? Math.round(s.hero.atk * (.9 + ready.level * .1)) : 0
    if (steamDamage) { s.enemy.hp -= steamDamage; s.wetPrimed = false; s.wetTicks = 0; synergy = 'NHIỆT BỐC HƠI!'; s.combatTexts.push(float(`CHUẨN -${steamDamage}`, 'enemy', 'crit')) }
    if (s.lastElement === 'moc' && ready.element === 'hoa') { power *= 1.4; synergy = 'MỘC SINH HỎA!' }
    if (ready.element === 'hoa' && s.enemy.frozen > 0) { power += .8; s.enemy.frozen = 0; synergy = 'NHIỆT BỐC HƠI!' }
    let critChance = s.crit + (ready.element === 'kim' ? .22 : 0)
    const crit = Math.random() < critChance
    let damage = Math.round(s.hero.atk * power * (crit ? s.critDmg : 1) * (100 / (100 + Math.max(0, s.enemy.def - (ready.element === 'kim' ? 12 : 0)))))
    s.enemy.hp -= damage; s.hero.qi -= ready.qi; s.skills[idx].cd = Math.max(1, ready.cooldown - Math.floor(s.savvy / 50) - (s.root.element === 'kim' && ready.element === 'kim' ? 1 : 0))
    s.combatTexts.push(float(`-${damage}${crit ? ' BẠO!' : ''}`, 'enemy', crit ? 'crit' : 'damage'))
    s.logs.push(log(`${ready.name} gây ${damage} sát thương.`, ready.element))
    if (synergy) { s.combatTexts.push(float(synergy, 'center', 'reward')); s.logs.push(log(synergy, ready.element)) }
    if (ready.status === 'burn') s.enemy.burn = Math.min(7, s.enemy.burn + 3)
    if (ready.element === 'thuy') { s.wetPrimed = true; s.wetTicks = 2; s.combatTexts.push(float('LÀM ƯỚT · 2', 'enemy', 'status')) }
    if (ready.status === 'poison') { s.enemy.poison = Math.min(7, s.enemy.poison + (wasWet ? 5 : 3)); s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + Math.round(s.hero.maxHp * .05 * (s.root.element === 'moc' ? 1.25 : 1))) }
    if (ready.status === 'freeze' && Math.random() < (.48 + (s.root.element === 'thuy' ? .1 : 0))) s.enemy.frozen = 1
    if (ready.status === 'shield') s.hero.shield += Math.round(s.hero.maxHp * .14)
    const heal = Math.round(damage * s.lifesteal * (s.root.element === 'moc' ? 1.25 : 1))
    if (heal > 0) { s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + heal); s.combatTexts.push(float(`+${heal} HP`, 'hero', 'heal')) }
    s.lastElement = ready.element; s.flash = 'enemy'; s.shake = crit || Boolean(synergy)
    audio.playSfx('spell', { volume: .5, rate: .95 + Math.random() * .1 })
  } else {
    const crit = Math.random() < s.crit
    const damage = Math.round(s.hero.atk * (crit ? s.critDmg : 1) * (100 / (100 + s.enemy.def)))
    s.enemy.hp -= damage; s.combatTexts.push(float(`-${damage}${crit ? '!' : ''}`, 'enemy', crit ? 'crit' : 'damage'))
    s.logs.push(log(`Lâm Phong xuất kiếm gây ${damage}.`, 'kim')); s.flash = 'enemy'
    s.swordIntent++
    if (s.root.element === 'hoa' && Math.random() < .2) { s.enemy.burn = Math.min(7, s.enemy.burn + 1); s.combatTexts.push(float('BỎNG', 'enemy', 'status')) }
    if (s.swordIntent >= 6 && s.talent.name !== 'Kiếm Tâm Thông Minh') {
      s.swordIntent = 0
      if (s.talent.name === 'Bách Độc Bất Xâm') {
        s.enemy.poison = Math.min(7, s.enemy.poison + 2); s.combatTexts.push(float('ĐỘC Ý +2', 'enemy', 'status'))
      } else if (s.talent.name === 'Đạo Pháp Tự Nhiên') {
        s.enemy.frozen = 1; s.combatTexts.push(float('CHƯỞNG Ý · PHONG ẤN', 'enemy', 'status'))
      } else {
        s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + Math.round(s.hero.maxHp * .04)); s.hero.qi = Math.min(s.hero.maxQi, s.hero.qi + 10); s.combatTexts.push(float('KHÍ VẬN HỘ THỂ', 'hero', 'heal'))
      }
    }
    if (s.swordIntent >= 6) {
      const swordDamage = Math.round(s.hero.atk * 1.6)
      s.enemy.hp -= swordDamage; s.swordIntent = 0
      s.combatTexts.push(float(`CỬU KIẾM -${swordDamage}`, 'enemy', 'crit'))
    }
    audio.playSfx('slash', { volume: .42, rate: .92 + Math.random() * .16 })
  }

  if (s.enemy.hp <= 0) return winFloor(s)

  if (s.enemy.frozen > 0) {
    s.enemy.frozen--
    s.combatTexts.push(float('ĐÓNG BĂNG', 'enemy', 'status'))
    return s
  }
  const raw = Math.max(1, Math.round(s.enemy.atk * (100 / (100 + s.hero.def))))
  let incoming = raw
  if (s.hero.shield > 0) {
    const absorbed = Math.min(s.hero.shield, incoming)
    s.hero.shield -= absorbed; incoming -= absorbed
    if (absorbed) s.combatTexts.push(float(`KHIÊN -${absorbed}`, 'hero', 'status'))
  }
  s.hero.hp -= incoming
  if (incoming) s.combatTexts.push(float(`-${incoming}`, 'hero', 'damage'))
  s.flash = incoming ? 'hero' : s.flash
  if (s.hero.hp <= 0) {
    s.hero.hp = 0; s.phase = 'dead'; s.shake = true
  }
  return s
}

function winFloor(s: RunState): RunState {
  const oldFloor = s.floor
  const gainExp = 24 + oldFloor * 5
  s.stones += 18 + oldFloor * 7
  s.exp += gainExp
  s.floor++
  s.combatTexts.push(float(`THẮNG! +${gainExp} EXP`, 'center', 'reward'))
  s.logs.push(log(`Vượt tầng ${oldFloor}, nhận Linh Thạch.`, 'kim'))
  if (s.floor % 10 === 5) {
    s.phase = 'shop'; s.eventSeen++
    audio.playSfx('reward', { volume: .5 })
  } else if (s.exp >= s.expNext) {
    s.level++; s.exp -= s.expNext; s.expNext = Math.round(s.expNext * 1.28)
    s.hero.maxHp += 42; s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + 110); s.hero.atk += 9
    s.phase = 'draft'; s.draftChoices = sample(TECHNIQUES, s.savvy >= 45 ? 4 : 3)
    audio.playSfx('reward', { volume: .65 })
  } else if (s.floor % 5 === 0) {
    s.phase = 'event'; s.eventSeen++
    audio.playSfx('reward', { volume: .5 })
  } else {
    return beginBattle(s)
  }
  return s
}

function TechniqueCard({ technique, onPick, owned }: { technique: Technique; onPick: () => void; owned?: boolean }) {
  const e = ELEMENTS[technique.element]
  return <button className={`tech-card rarity-${technique.rarity.toLowerCase().replace(' ', '-')}`} onClick={onPick} style={{ '--element': e.color } as React.CSSProperties}>
    <div className="tech-top"><span className="tech-icon">{technique.icon}</span><span className="rarity">{technique.rarity}</span></div>
    <strong>{technique.name}</strong>
    <span className="element-tag">{e.icon} {e.label}</span>
    <p>{technique.description}</p>
    <div className="tech-cost"><span>Qi {technique.qi}</span><span>CD {technique.cooldown} Tick</span></div>
    {owned && <span className="upgrade-label">ĐỘT PHÁ +1</span>}
  </button>
}

export default function App() {
  const [meta, setMeta] = useState<MetaState>(loadMeta)
  const [run, setRun] = useState<RunState>(() => initialRun(loadMeta()))
  const [isEnteringBattle, setIsEnteringBattle] = useState(false)
  const runRef = useRef(run)
  runRef.current = run

  useEffect(() => {
    void Promise.all([
      audio.load('bgm', ASSETS.bgmNineHeavens), audio.load('slash', ASSETS.sfxSlash),
      audio.load('spell', ASSETS.sfxSpell), audio.load('reward', ASSETS.sfxReward),
    ]).then(() => audio.playBgm('bgm', { volume: .32 }))
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRun(prev => {
        if (prev.phase !== 'battle') return prev
        const skipMultiplier = prev.autoSkip && !prev.enemy.boss ? 4 : 1
        const progress = prev.tickProgress + .05 * prev.speed * skipMultiplier
        if (progress < 1) return { ...prev, tickProgress: progress }
        return resolveTick(prev)
      })
    }, 50)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (run.phase !== 'dead') return
    const souls = Math.max(1, Math.floor(run.floor * 1.4 + run.eventSeen * 3 + run.savvy / 12))
    setMeta(current => {
      const updated = { ...current, souls: current.souls + souls, totalRuns: current.totalRuns + 1, bestFloor: Math.max(current.bestFloor, run.floor) }
      localStorage.setItem(META_KEY, JSON.stringify(updated)); return updated
    })
  }, [run.phase])

  const startRun = useCallback(() => {
    if (isEnteringBattle) return
    setIsEnteringBattle(true)
    window.setTimeout(() => {
      setRun(prev => beginBattle(prev, enemyFor(1)))
      setIsEnteringBattle(false)
    }, 620)
  }, [isEnteringBattle])
  const newRun = useCallback(() => setRun(initialRun(meta)), [meta])
  const cycleSpeed = () => setRun(prev => ({ ...prev, speed: SPEEDS[(SPEEDS.indexOf(prev.speed as typeof SPEEDS[number]) + 1) % SPEEDS.length] }))
  const toggleMute = () => setRun(prev => { audio.setMuted(!prev.muted); return { ...prev, muted: !prev.muted } })

  const chooseTechnique = (tech: Technique) => {
    setRun(prev => {
      const existing = prev.skills.find(s => s.id === tech.id)
      const skills: SkillSlot[] = existing
        ? prev.skills.map(s => s.id === tech.id ? { ...s, level: s.level + 1 } : s)
        : [...prev.skills, { ...tech, cd: 0, level: 1 }].slice(-4)
      return beginBattle({ ...prev, skills, logs: [...prev.logs, log(existing ? `${tech.name} đột phá Nhập Môn!` : `Lĩnh ngộ ${tech.name}!`, tech.element)] }, prev.enemy.hp <= 0 ? enemyFor(prev.floor) : prev.enemy)
    })
    audio.playSfx('reward', { volume: .7 })
  }

  const chooseEvent = (kind: 'chest' | 'heal' | 'master') => {
    setRun(prev => {
      const next = { ...prev, hero: { ...prev.hero }, treasures: [...prev.treasures], logs: [...prev.logs] }
      if (kind === 'chest') { next.treasures.push('phoenix-vase'); next.hero.atk += 14; next.logs.push(log('Nhận Bình Chu Tước: ATK +14, địch Bỏng hồi 5 Qi.', 'hoa')) }
      if (kind === 'heal') { next.hero.hp = next.hero.maxHp; next.hero.maxHp += 55; next.logs.push(log('Tẩy Tủy thành công: HP tối đa +55.', 'moc')) }
      if (kind === 'master') { next.savvy += 12; next.hero.qi = next.hero.maxQi; next.logs.push(log('Cao nhân điểm hóa: Ngộ Tính +12.', 'thuy')) }
      return beginBattle(next, enemyFor(next.floor))
    })
    audio.playSfx('reward', { volume: .72 })
  }

  const rerollDraft = () => setRun(prev => {
    const cost = 22
    if (prev.stones < cost) return prev
    return { ...prev, stones: prev.stones - cost, draftChoices: sample(TECHNIQUES, prev.savvy >= 45 ? 4 : 3), logs: [...prev.logs, log('Thương Hội xoay chuyển cơ duyên Draft.', 'kim')] }
  })

  const buyRelic = (id: 'phoenix-vase' | 'void-jade') => setRun(prev => {
    const cost = id === 'phoenix-vase' ? 55 : 70
    if (prev.stones < cost || prev.treasures.includes(id) || prev.treasures.length >= 2) return prev
    return { ...prev, stones: prev.stones - cost, treasures: [...prev.treasures, id], logs: [...prev.logs, log(id === 'phoenix-vase' ? 'Mua Bình Chu Tước: địch Bỏng hồi 5 Qi.' : 'Mua Hư Không Ngọc: Qi tối đa +25.', 'hoa')], hero: id === 'void-jade' ? { ...prev.hero, maxQi: prev.hero.maxQi + 25, qi: prev.hero.qi + 25 } : prev.hero }
  })

  const upgradeSkillAtShop = (skillId: string) => setRun(prev => {
    const cost = 34
    if (prev.stones < cost) return prev
    return { ...prev, stones: prev.stones - cost, skills: prev.skills.map(skill => skill.id === skillId ? { ...skill, level: skill.level + 1 } : skill), logs: [...prev.logs, log('Tẩy Tủy thành công: Công Pháp +1.', 'thuy')] }
  })

  const leaveShop = () => setRun(prev => beginBattle(prev, enemyFor(prev.floor)))

  const buyLegacy = (type: 'atk' | 'hp' | 'savvy') => {
    const costs = { atk: 8 + meta.legacyAtk * 6, hp: 8 + meta.legacyHp * 6, savvy: 10 + meta.legacySavvy * 8 }
    if (meta.souls < costs[type]) return
    setMeta(prev => {
      const next = { ...prev, souls: prev.souls - costs[type], legacyAtk: prev.legacyAtk + (type === 'atk' ? 1 : 0), legacyHp: prev.legacyHp + (type === 'hp' ? 1 : 0), legacySavvy: prev.legacySavvy + (type === 'savvy' ? 1 : 0) }
      localStorage.setItem(META_KEY, JSON.stringify(next)); return next
    })
  }

  const hpPct = Math.max(0, run.hero.hp / run.hero.maxHp * 100)
  const enemyPct = Math.max(0, run.enemy.hp / run.enemy.maxHp * 100)
  const qiPct = run.hero.qi / run.hero.maxQi * 100
  const expPct = run.exp / run.expNext * 100
  const rootElement = ELEMENTS[run.root.element]
  const activeSpirit = SPIRIT_VARIANTS.find(spirit => spirit.name === run.spirit) || SPIRIT_VARIANTS[0]
  const bossLabel = run.enemy.boss ? 'BOSS' : `TẦNG ${run.floor}`
  const soulGain = Math.max(1, Math.floor(run.floor * 1.4 + run.eventSeen * 3 + run.savvy / 12))

  if (run.phase === 'title') return <main className="rebirth-shell" style={{ '--root-color': rootElement.color } as React.CSSProperties}>
    <div className={`rebirth-overlay ${isEnteringBattle ? 'is-dissolving' : ''}`}>
      <div className="rebirth-stars"/><div className="rebirth-rune rune-one">{rootElement.icon}</div><div className="rebirth-rune rune-two">☯</div>
      <section className="rebirth-content">
        <p className="eyebrow">CỬU THIÊN · LUÂN HỒI KHAI MỆNH</p>
        <div className="rebirth-emblem" style={{ color: rootElement.color }}>{rootElement.icon}</div>
        <h1>KIẾP MỚI<br/><span>ĐÃ KHAI MỞ</span></h1>
        <p className="rebirth-copy">Linh quang hội tụ. Một hành trình leo Tháp Cửu Thiên mới đang chờ ngươi.</p>
        <div className="awakening-grid">
          <article><small>LINH CĂN THỨC TỈNH</small><b style={{ color: rootElement.color }}>{rootElement.icon} {run.root.name}</b><p>{run.root.bonus}</p><em>{run.root.detail}</em></article>
          <article><small>THIÊN PHÚ BẨM SINH</small><b>{run.talent.icon} {run.talent.name}</b><p>{run.talent.detail}</p><em>Linh thú đồng hành: {activeSpirit.name}</em></article>
          <article className="legacy-card"><small>DI SẢN LUÂN HỒI ĐANG HIỆU LỰC</small><div><span>⚔ +{meta.legacyAtk * 7} ATK</span><span>♥ +{meta.legacyHp * 55} HP</span><span>☯ +{meta.legacySavvy * 3} Ngộ Tính</span></div><em>{meta.souls} ◉ Điểm Luân Hồi còn lại</em></article>
        </div>
        <button className="primary-btn rebirth-start" onClick={startRun} disabled={isEnteringBattle}><span>{isEnteringBattle ? 'DUNG HỢP THIÊN MỆNH...' : 'BẮT ĐẦU TU LUYỆN'}</span><small>{isEnteringBattle ? 'Cửa tháp đang mở' : 'Tiến vào tầng một Tháp Cửu Thiên'}</small></button>
      </section>
    </div>
  </main>

  return <main className={`game-shell ${run.shake ? 'shake' : ''}`}>
    <div className="sky" style={{ backgroundImage: `linear-gradient(180deg, rgba(4,12,28,.04), rgba(2,8,18,.5)), url(${ASSETS.celestialTower})` }} />
    <div className="cloud cloud-a"/><div className="cloud cloud-b"/>

    <header className="topbar">
      <div className="brand-mini"><span className="seal">九</span><div><b>CỬU THIÊN</b><small>LUÂN HỒI</small></div></div>
      <div className="floor-plaque"><small>{bossLabel}</small><strong>THÁP CỬU THIÊN · {run.floor}</strong></div>
      <div className="top-actions"><span className="currency">◈ {run.stones}</span><button onClick={toggleMute} aria-label="Âm thanh">{run.muted ? '🔇' : '🔊'}</button></div>
    </header>

    <section className="combat-hud hero-hud">
      <div className="portrait hero-portrait"><img src={ASSETS.lamPhong}/><span>{run.level}</span></div>
      <div className="fighter-bars"><div className="fighter-name"><b>Lâm Phong</b><small>{run.root.name}</small></div>
        <div className="bar hp"><i style={{ width: `${hpPct}%` }}/><em>{Math.ceil(run.hero.hp)} / {run.hero.maxHp}</em></div>
        <div className="bar qi"><i style={{ width: `${qiPct}%` }}/><em>NỘI LỰC {Math.floor(run.hero.qi)}</em></div>
      </div>
    </section>

    <section className="combat-hud enemy-hud">
      <div className="fighter-bars"><div className="fighter-name"><small>Lv. {run.enemy.level} · {run.enemy.boss ? 'YÊU VƯƠNG' : 'HỘ THÁP'}</small><b>{run.enemy.name}</b></div>
        <div className="bar hp enemy"><i style={{ width: `${enemyPct}%` }}/><em>{Math.ceil(Math.max(0, run.enemy.hp))} / {run.enemy.maxHp}</em></div>
        <div className="status-row">{run.enemy.burn > 0 && <span>🔥 {run.enemy.burn}</span>}{run.enemy.poison > 0 && <span>☠ {run.enemy.poison}</span>}{run.enemy.frozen > 0 && <span>❄ Đóng Băng</span>}{run.wetPrimed && <span>💧 Ướt {run.wetTicks}</span>}</div>
      </div>
      <div className={`portrait enemy-portrait ${run.enemy.boss ? 'boss-portrait' : ''}`}><img src={run.enemy.sprite}/><span>{run.enemy.level}</span></div>
    </section>

    <div className="tick-track"><div className="tick-fill" style={{ width: `${run.tickProgress * 100}%` }}/><span>TICK {run.tick + 1}</span></div>

    <section className="battle-stage">
      <div className={`hero-unit ${run.flash === 'hero' ? 'hit' : ''}`}><div className="aura aura-hero"/><img className="hero-sprite" src={ASSETS.lamPhong}/><img className="fox-sprite" src={activeSpirit.sprite}/><div className="unit-label">Lâm Phong <span>✦ {run.swordIntent}/6</span></div></div>
      <div className="versus-rune">☯</div>
      <div className={`enemy-unit ${run.enemy.boss ? 'boss-unit' : ''} ${run.flash === 'enemy' ? 'hit' : ''}`}><div className="aura aura-enemy"/><img className="enemy-sprite" src={run.enemy.sprite}/><div className="unit-label enemy-label">{run.enemy.name}</div></div>
      {run.combatTexts.map(t => <span key={t.id} className={`floating ${t.side} ${t.tone}`}>{t.text}</span>)}
    </section>

    <section className="bottom-deck">
      <div className="stats-strip"><span>⚔ {run.hero.atk}</span><span>🛡 {run.hero.def}</span><span>✹ {Math.round(run.crit * 100)}%</span><span>☯ {run.savvy}</span><span style={{ color: rootElement.color }}>{rootElement.icon} {rootElement.label}</span></div>
      <div className="skills-row">
        {run.skills.map(skill => <div className="skill-slot" key={skill.id} style={{ '--element': ELEMENTS[skill.element].color } as React.CSSProperties}>
          <div className="skill-icon">{skill.icon}{skill.cd > 0 && <span className="cooldown">{skill.cd}</span>}</div>
          <b>{skill.name}</b><small>Lv.{skill.level} · {skill.qi} Qi</small>
        </div>)}
        {Array.from({ length: Math.max(0, 4 - run.skills.length) }).map((_, i) => <div className="skill-slot empty" key={i}><div className="skill-icon">＋</div><b>Ô Công Pháp</b><small>Chưa lĩnh ngộ</small></div>)}
      </div>
      <div className="relic-row">{['phoenix-vase', 'void-jade'].map((relicId, index) => {
        const owned = run.treasures.includes(relicId)
        const label = relicId === 'phoenix-vase' ? 'Bình Chu Tước' : 'Hư Không Ngọc'
        const icon = relicId === 'phoenix-vase' ? '🏺' : '🔮'
        return <div key={relicId} className={`relic-slot ${owned ? 'owned' : ''}`}><span>{owned ? icon : '＋'}</span><small>{owned ? label : `Ô Pháp Bảo ${index + 1}`}</small></div>
      })}</div>
      <div className="battle-controls"><button className="speed-btn" onClick={cycleSpeed}>TỐC ĐỘ <b>×{run.speed}</b></button><button className={run.autoSkip ? 'active' : ''} onClick={() => setRun(p => ({ ...p, autoSkip: !p.autoSkip }))}>AUTO-SKIP</button><div className="exp"><span>Lv. {run.level}</span><div className="bar expbar"><i style={{ width: `${expPct}%` }}/></div><small>{run.exp}/{run.expNext} EXP</small></div></div>
    </section>

    <aside className="battle-log">{run.logs.slice(-4).map(entry => <p key={entry.id} style={{ color: entry.element ? ELEMENTS[entry.element].color : undefined }}><span>›</span> {entry.text}</p>)}</aside>

    {run.phase === 'draft' && <div className="overlay modal-layer"><div className="modal draft-modal">
      <div className="modal-title"><span>☯</span><div><small>CƠ DUYÊN LĨNH NGỘ</small><h2>CHỌN MỘT CÔNG PHÁP</h2></div><span>☯</span></div>
      <p>Đột phá cảnh giới · Lâm Phong đạt <b>Lv. {run.level}</b></p>
      <button className="reroll-btn" onClick={rerollDraft} disabled={run.stones < 22}>Thương Hội Reroll · 22 ◈</button>
      <div className="draft-grid">{run.draftChoices.map(t => <TechniqueCard key={t.id} technique={t} owned={run.skills.some(s => s.id === t.id)} onPick={() => chooseTechnique(t)}/>)}</div>
    </div></div>}

    {run.phase === 'event' && <div className="overlay modal-layer"><div className="modal event-modal">
      <div className="modal-title"><span>✦</span><div><small>CƠ DUYÊN TẦNG {run.floor}</small><h2>NGÃ BA VẬN MỆNH</h2></div><span>✦</span></div>
      <p>Khí vận rung chuyển. Mỗi lựa chọn sẽ định hình con đường tu luyện.</p>
      <div className="event-grid">
        <button onClick={() => chooseEvent('chest')}><span>🏺</span><b>Rương Cổ Bí Ẩn</b><small>Nhận Bình Chu Tước<br/>ATK +14</small></button>
        <button onClick={() => chooseEvent('heal')}><span>♨</span><b>Đài Tẩy Tủy</b><small>Hồi đầy Sinh Mệnh<br/>HP tối đa +55</small></button>
        <button onClick={() => chooseEvent('master')}><span>仙</span><b>Kỳ Ngộ Cao Nhân</b><small>Ngộ Tính +12<br/>Hồi đầy Nội Lực</small></button>
      </div>
    </div></div>}

    {run.phase === 'shop' && <div className="overlay modal-layer"><div className="modal shop-modal">
      <div className="modal-title"><span>◈</span><div><small>THƯƠNG HỘI VẠN BẢO · TẦNG {run.floor}</small><h2>PHÁP BẢO & TẨY TỦY</h2></div><span>◈</span></div>
      <p>Linh Thạch hiện có: <b>{run.stones} ◈</b> · Pháp Bảo không tốn Qi, không chiếm ô Công Pháp.</p>
      <div className="shop-grid">
        <button onClick={() => buyRelic('phoenix-vase')} disabled={run.stones < 55 || run.treasures.includes('phoenix-vase') || run.treasures.length >= 2}><span>🏺</span><b>Bình Chu Tước</b><small>Mỗi Tick địch bị Bỏng: hồi 5 Qi</small><em>55 ◈</em></button>
        <button onClick={() => buyRelic('void-jade')} disabled={run.stones < 70 || run.treasures.includes('void-jade') || run.treasures.length >= 2}><span>🔮</span><b>Hư Không Ngọc</b><small>Qi tối đa +25, hồi ngay 25 Qi</small><em>70 ◈</em></button>
      </div>
      <div className="shop-skills">{run.skills.map(skill => <button key={skill.id} onClick={() => upgradeSkillAtShop(skill.id)} disabled={run.stones < 34}><span>{skill.icon}</span><b>{skill.name} · Lv.{skill.level}</b><small>Tẩy Tủy +1 · 34 ◈</small></button>)}</div>
      <button className="primary-btn" onClick={leaveShop}><span>RỜI THƯƠNG HỘI</span><small>Tiến vào trận chiến kế tiếp</small></button>
    </div></div>}

    {run.phase === 'dead' && <div className="overlay modal-layer death-layer"><div className="modal death-modal">
      <div className="death-symbol">☯</div><small>ĐẠO TIÊU THÂN VẪN</small><h2>TRỞ VỀ CÕI LUÂN HỒI</h2><p>Kiếp này dừng tại tầng <b>{run.floor}</b>. Tu vi hóa thành di sản cho kiếp sau.</p>
      <div className="soul-result"><span>ĐIỂM LUÂN HỒI NHẬN</span><b>+{soulGain} ◉</b></div>
      <div className="legacy-grid">
        <button onClick={() => buyLegacy('atk')}><span>⚔</span><b>Kiếm Đạo</b><small>ATK vĩnh viễn +7</small><em>{8 + meta.legacyAtk * 6} ◉ · Lv.{meta.legacyAtk}</em></button>
        <button onClick={() => buyLegacy('hp')}><span>♥</span><b>Tiên Thể</b><small>HP vĩnh viễn +55</small><em>{8 + meta.legacyHp * 6} ◉ · Lv.{meta.legacyHp}</em></button>
        <button onClick={() => buyLegacy('savvy')}><span>☯</span><b>Ngộ Đạo</b><small>Ngộ Tính vĩnh viễn +3</small><em>{10 + meta.legacySavvy * 8} ◉ · Lv.{meta.legacySavvy}</em></button>
      </div>
      <p className="soul-wallet">Đang sở hữu: <b>{meta.souls} ◉</b></p><button className="primary-btn" onClick={newRun}><span>CHUYỂN SINH</span><small>Khởi tạo Linh Căn và Thiên Phú mới</small></button>
    </div></div>}
  </main>
}
