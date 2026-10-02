import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGame, type CamPreset, type EditTab } from '../../store/game'
import { CATEGORIES, ITEMS, ITEM_BY_ID, PATTERNS } from '../../data/items'
import { HAIR_STYLES } from '../../data/hair'
import { DOLLS } from '../../data/characters'
import { CHALLENGE_BY_ID } from '../../data/challenges'
import { BLUSH_COLORS, CLOTH_COLORS, EYESHADOW_COLORS, GEM_COLORS, HAIR_COLORS, LINER_COLORS, LIP_COLORS, NAIL_COLORS } from '../../data/palette'
import { FACE_GEMS, LASHES, LINERS, LIP_FINISHES, NAIL_FINISHES, NAIL_SHAPES } from '../../data/beauty'
import type { Category, ItemDef, Slot, StyleTag } from '../../data/types'
import { isItemUnlocked, unlockHint } from '../../game/economy'
import { tagLabel } from '../../game/scoring'
import { COLOR_FAMILIES, EMPTY_FILTER, STYLE_NAMES, availableFacets, filterItems, isFiltering, normalize, type ColorFamily, type ItemFilter } from '../../game/filters'
import { Btn, IconBtn, Modal, TopBar, useInsetReporter, useInsetTop } from '../kit'
import { Icon, type IconName } from '../Icon'
import { ItemGlyph } from '../ItemGlyph'
import { prefetchThumbs } from '../thumbs'
import { useView, interaction } from '../../three/view'
import { audio, buzz } from '../../audio/engine'
import Onboarding from './Onboarding'

const CAT_ICON: Record<Category, IconName> = {
  tops: 'shirt',
  bottoms: 'pants',
  dresses: 'dress',
  jackets: 'jacket',
  shoes: 'shoe',
  bags: 'bag',
  jewelry: 'gem',
  glasses: 'glasses',
  hats: 'hat',
  hairAcc: 'bow',
}

const TABS: { id: EditTab; label: string; icon: IconName }[] = [
  { id: 'ropa', label: 'Ropa', icon: 'hanger' },
  { id: 'pelo', label: 'Pelo', icon: 'hair' },
  { id: 'maquillaje', label: 'Maquillaje', icon: 'brush' },
  { id: 'unas', label: 'Uñas', icon: 'nail' },
]

function Swatches({ colors, value, onPick, label }: { colors: string[]; value: string; onPick: (c: string) => void; label: string }) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <motion.button
          key={c}
          role="radio"
          aria-checked={c.toLowerCase() === value.toLowerCase()}
          aria-label={`${label} ${c}`}
          className={`swatch ${c.toLowerCase() === value.toLowerCase() ? 'active' : ''}`}
          style={{ background: `radial-gradient(circle at 35% 30%, #fff8 0, ${c} 45%)` }}
          whileTap={{ scale: 0.82 }}
          onClick={() => {
            audio.click()
            buzz(6)
            onPick(c)
          }}
        />
      ))}
    </div>
  )
}

function Slider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <input
      className="slider"
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

function Chips<T extends string>({ options, value, onPick, testid }: { options: { id: T; name: string }[]; value: T; onPick: (v: T) => void; testid?: string }) {
  return (
    <div className="row wrap" style={{ gap: 6 }}>
      {options.map((o) => (
        <motion.button
          key={o.id}
          className={`chip ${o.id === value ? 'active' : ''}`}
          whileTap={{ scale: 0.9 }}
          aria-pressed={o.id === value}
          data-testid={testid ? `${testid}-${o.id}` : undefined}
          onClick={() => {
            audio.click()
            buzz(6)
            onPick(o.id)
          }}
        >
          {o.name}
        </motion.button>
      ))}
    </div>
  )
}

// ───────────────────── Ropa ─────────────────────

const SPARKS = [0, 1, 2, 3, 4, 5, 6, 7]

function ItemCard({ item, onPick }: { item: ItemDef; onPick?: (el: HTMLElement) => void }) {
  const save = useGame((s) => s.save)
  const worn = useGame((s) => s.look.outfit[item.slot]?.itemId === item.id)
  const inst = useGame((s) => s.look.outfit[item.slot])
  const wear = useGame((s) => s.wear)
  const toast = useGame((s) => s.toast)
  const unlocked = isItemUnlocked(item, save)
  // microinteracción al ponerse o quitarse la prenda (n reinicia la animación)
  const [fx, setFx] = useState<{ kind: 'on' | 'off' | 'nope'; n: number } | null>(null)
  useEffect(() => {
    if (!fx) return
    const t = window.setTimeout(() => setFx(null), 900)
    return () => window.clearTimeout(t)
  }, [fx])
  return (
    <motion.button
      className={`card ${worn ? 'worn' : ''} ${unlocked ? '' : 'locked'} ${fx ? `fx-${fx.kind}` : ''}`}
      whileTap={{ scale: 0.88 }}
      whileHover={{ y: -2 }}
      aria-label={`${item.name}${worn ? ' (puesta)' : ''}${unlocked ? '' : ' (bloqueada)'}`}
      aria-pressed={worn}
      data-testid={`item-${item.id}`}
      onClick={(e) => {
        if (!unlocked) {
          audio.error()
          buzz(8)
          setFx((f) => ({ kind: 'nope', n: (f?.n ?? 0) + 1 }))
          toast(`${item.name}: ${unlockHint(item)}`)
          return
        }
        audio.sparkle()
        buzz(worn ? 8 : 16)
        setFx((f) => ({ kind: worn ? 'off' : 'on', n: (f?.n ?? 0) + 1 }))
        onPick?.(e.currentTarget)
        wear(item)
      }}
    >
      <span className="glyph-wrap" key={fx ? `${fx.kind}${fx.n}` : 'quieto'}>
        <ItemGlyph item={item} color={worn ? inst?.color : undefined} color2={worn ? inst?.color2 : undefined} pattern={worn ? inst?.pattern : undefined} />
      </span>
      <span className="label">{item.name}</span>
      {fx?.kind === 'on' && (
        <span className="equip-burst" key={fx.n} aria-hidden="true" data-testid="equip-burst">
          <span className="ring" />
          {SPARKS.map((i) => (
            <span key={i} className="spark" style={{ '--a': `${i * 45 + 20}deg` } as React.CSSProperties} />
          ))}
        </span>
      )}
      {worn && (
        <span className="worn-tick" aria-hidden="true">
          <Icon name="check" />
        </span>
      )}
      {item.rarity !== 'comun' && (
        <svg className="badge" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.2 5.8 20.9l1.6-7L2 9.2l7.1-.6z" fill={item.rarity === 'secreta' ? '#c38bff' : '#ffd25a'} stroke="#fff" strokeWidth="1.5" />
        </svg>
      )}
      {!unlocked && <Icon name="lock" className="lock" />}
    </motion.button>
  )
}

function ItemEditor({ slot }: { slot: Slot }) {
  const inst = useGame((s) => s.look.outfit[slot])
  const setInstance = useGame((s) => s.setInstance)
  const wear = useGame((s) => s.wear)
  if (!inst) return null
  const item = ITEM_BY_ID[inst.itemId]
  if (!item) return null
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass" style={{ padding: 10, margin: '0 0 8px', borderRadius: 18 }} data-testid="item-editor">
      <div className="section-title" style={{ marginTop: 0 }}>
        <span>{item.name}</span>
        <Btn variant="secondary" size="small" onClick={() => wear(item)} data-testid="remove-item">
          <Icon name="close" width={18} height={18} /> Quitar
        </Btn>
      </div>
      {item.editable ? (
        <>
          <Swatches colors={CLOTH_COLORS} value={inst.color} onPick={(c) => setInstance(slot, { color: c })} label="Color" />
          {['tops', 'bottoms', 'dresses', 'jackets', 'bags', 'hats'].includes(item.category) && (
            <>
              <div className="section-title">Estampado</div>
              <Chips options={PATTERNS} value={inst.pattern} onPick={(p) => setInstance(slot, { pattern: p })} testid="pattern" />
              {inst.pattern !== 'liso' && (
                <>
                  <div className="section-title">Segundo color</div>
                  <Swatches colors={CLOTH_COLORS} value={inst.color2 ?? item.color2 ?? '#ffffff'} onPick={(c) => setInstance(slot, { color2: c })} label="Segundo color" />
                </>
              )}
            </>
          )}
        </>
      ) : (
        <p style={{ margin: 0, color: 'var(--ink-soft)' }}>{item.story ?? 'Esta pieza no se puede recolorear.'}</p>
      )}
    </motion.div>
  )
}

const catName = (i: ItemDef) => CATEGORIES.find((c) => c.id === i.category)?.name ?? ''

function FilterPanel({ filter, setFilter, pool }: { filter: ItemFilter; setFilter: (f: ItemFilter) => void; pool: ItemDef[] }) {
  const facets = useMemo(() => availableFacets(pool), [pool])
  // los ya elegidos se siguen mostrando aunque no haya prendas de ese tipo aquí
  const tags = [...new Set([...facets.tags, ...filter.tags])]
  const colors = COLOR_FAMILIES.filter((c) => facets.colors.includes(c.id) || filter.colors.includes(c.id))
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  return (
    <motion.div className="filter-panel" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} data-testid="filter-panel">
      <div className="section-title" style={{ marginTop: 2 }}>
        Estilo
      </div>
      <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="Filtrar por estilo">
        {tags.map((t: StyleTag) => (
          <motion.button
            key={t}
            className={`chip small ${filter.tags.includes(t) ? 'active' : ''}`}
            whileTap={{ scale: 0.9 }}
            aria-pressed={filter.tags.includes(t)}
            data-testid={`filter-tag-${t}`}
            onClick={() => {
              audio.click()
              setFilter({ ...filter, tags: toggle(filter.tags, t) })
            }}
          >
            {STYLE_NAMES[t]}
          </motion.button>
        ))}
      </div>
      <div className="section-title">Color</div>
      <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="Filtrar por color">
        {colors.map((c) => (
          <motion.button
            key={c.id}
            className={`chip small color-chip ${filter.colors.includes(c.id) ? 'active' : ''}`}
            whileTap={{ scale: 0.9 }}
            aria-pressed={filter.colors.includes(c.id)}
            data-testid={`filter-color-${c.id}`}
            onClick={() => {
              audio.click()
              setFilter({ ...filter, colors: toggle(filter.colors, c.id as ColorFamily) })
            }}
          >
            <span className="dot" style={{ background: c.swatch }} />
            {c.name}
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}

function ClothesPanel() {
  const category = useGame((s) => s.category)
  const setCategory = useGame((s) => s.setCategory)
  const outfit = useGame((s) => s.look.outfit)
  const selectedSlot = useGame((s) => s.selectedSlot)
  const [filter, setFilter] = useState<ItemFilter>(EMPTY_FILTER)
  const [searchOpen, setSearchOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const searching = normalize(filter.query) !== ''
  // con texto se busca en todo el vestidor; sin él, dentro de la categoría
  const pool = useMemo(() => (searching ? ITEMS : ITEMS.filter((i) => i.category === category)), [searching, category])
  const items = useMemo(() => filterItems(pool, filter, catName), [pool, filter])
  const filtering = isFiltering(filter)
  const nFilters = filter.tags.length + filter.colors.length
  const wornCats = useMemo(() => new Set(Object.values(outfit).map((o) => (o ? ITEM_BY_ID[o.itemId]?.category : undefined))), [outfit])
  const slotsHere = [...new Set(ITEMS.filter((i) => i.category === category).map((i) => i.slot))].filter((s) => outfit[s])
  const editSlot = searching ? (selectedSlot && outfit[selectedSlot] ? selectedSlot : undefined) : selectedSlot && slotsHere.includes(selectedSlot) ? selectedSlot : slotsHere[0]
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [category, filter])
  // al ponerse una prenda aparece (o cambia) su editor encima de la lista:
  // se compensa el desplazamiento para que la tarjeta tocada no salte
  const anchor = useRef<{ id: string; top: number } | null>(null)
  const keepInView = useCallback((el: HTMLElement) => {
    anchor.current = { id: el.dataset.testid ?? '', top: el.getBoundingClientRect().top }
  }, [])
  useLayoutEffect(() => {
    const a = anchor.current
    anchor.current = null
    const sc = scroller.current
    if (!a || !sc) return
    const el = sc.querySelector<HTMLElement>(`[data-testid="${a.id}"]`)
    if (el) sc.scrollTop += el.getBoundingClientRect().top - a.top
  }, [outfit])
  const clear = () => {
    audio.click()
    setFilter(EMPTY_FILTER)
  }
  const closeSearch = () => {
    audio.click()
    setFilter((f) => ({ ...f, query: '' }))
    setSearchOpen(false)
  }
  const filtersBtn = (
    <motion.button
      className={`chip ${filtersOpen || nFilters ? 'active' : ''}`}
      whileTap={{ scale: 0.9 }}
      aria-expanded={filtersOpen}
      aria-label={`Filtros por estilo y color${nFilters ? ` (${nFilters} activos)` : ''}`}
      data-testid="filters-toggle"
      onClick={() => {
        audio.click()
        setFiltersOpen((o) => !o)
      }}
    >
      <Icon name="filter" />
      {nFilters > 0 && <span className="count-badge">{nFilters}</span>}
    </motion.button>
  )
  return (
    <>
      {searchOpen ? (
        <div className="chips search-row">
          <label className="search-box">
            <Icon name="search" />
            <input
              ref={input}
              type="search"
              value={filter.query}
              placeholder="Busca prenda, estilo o color"
              aria-label="Buscar en el vestidor"
              enterKeyHint="search"
              autoComplete="off"
              data-testid="search"
              onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
              onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
            />
          </label>
          {filtersBtn}
          <motion.button className="chip" whileTap={{ scale: 0.9 }} aria-label="Cerrar búsqueda" data-testid="search-close" onClick={closeSearch}>
            <Icon name="close" />
          </motion.button>
        </div>
      ) : (
        <div className="chips" role="tablist" aria-label="Categorías">
          <motion.button
            className="chip"
            whileTap={{ scale: 0.9 }}
            aria-label="Buscar en el vestidor"
            data-testid="search-toggle"
            onClick={() => {
              audio.click()
              setSearchOpen(true)
              requestAnimationFrame(() => input.current?.focus())
            }}
          >
            <Icon name="search" />
          </motion.button>
          {filtersBtn}
          {CATEGORIES.map((c) => (
            <motion.button
              key={c.id}
              role="tab"
              aria-selected={c.id === category}
              className={`chip ${c.id === category ? 'active' : ''}`}
              whileTap={{ scale: 0.9 }}
              data-testid={`cat-${c.id}`}
              onClick={() => {
                audio.click()
                setCategory(c.id)
              }}
            >
              <Icon name={CAT_ICON[c.id]} />
              {c.name}
              {wornCats.has(c.id) && <span className="worn-dot" aria-hidden="true" />}
            </motion.button>
          ))}
        </div>
      )}
      <div className="scroll" ref={scroller}>
        {filtersOpen && <FilterPanel filter={filter} setFilter={setFilter} pool={pool} />}
        {filtering && (
          <div className="filter-status" aria-live="polite">
            <span data-testid="filter-count">
              {items.length === 1 ? '1 prenda' : `${items.length} prendas`}
              {searching ? ' en todo el vestidor' : ''}
            </span>
            <Btn variant="secondary" size="small" onClick={clear} data-testid="filters-clear">
              Quitar filtros
            </Btn>
          </div>
        )}
        {editSlot && !filtersOpen && <ItemEditor slot={editSlot} />}
        {items.length ? (
          <div className="grid">
            {items.map((i) => (
              <ItemCard key={i.id} item={i} onPick={keepInView} />
            ))}
          </div>
        ) : (
          <div className="filter-empty" data-testid="filter-empty">
            <Icon name="hanger" />
            <p>No hay ninguna prenda así… ¡todavía!</p>
            <Btn variant="secondary" size="small" sound="none" onClick={clear}>
              Quitar filtros
            </Btn>
          </div>
        )}
      </div>
    </>
  )
}

// ───────────────────── Pelo ─────────────────────

function HairPanel() {
  const hair = useGame((s) => s.look.hair)
  const setLook = useGame((s) => s.setLook)
  const set = (p: Partial<typeof hair>) => setLook((l) => ({ ...l, hair: { ...l.hair, ...p } }))
  return (
    <div className="scroll">
      <div className="section-title">Peinado</div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))' }}>
        {HAIR_STYLES.map((h) => (
          <motion.button
            key={h.id}
            className={`card ${hair.styleId === h.id ? 'worn' : ''}`}
            style={{ aspectRatio: '2.1', padding: 6 }}
            whileTap={{ scale: 0.9 }}
            aria-pressed={hair.styleId === h.id}
            data-testid={`hair-${h.id}`}
            onClick={() => {
              audio.sparkle()
              set({ styleId: h.id })
            }}
          >
            <span className="display" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.1, color: 'var(--ink)' }}>
              {h.name}
            </span>
          </motion.button>
        ))}
      </div>
      <div className="section-title">Color base</div>
      <Swatches colors={HAIR_COLORS} value={hair.base} onPick={(c) => set({ base: c })} label="Color de pelo" />
      <div className="section-title">
        <span>Mechas</span>
        <Toggle on={hair.highlightsOn} onChange={(v) => set({ highlightsOn: v })} label="Mechas" />
      </div>
      {hair.highlightsOn && <Swatches colors={HAIR_COLORS} value={hair.highlights} onPick={(c) => set({ highlights: c })} label="Color de mechas" />}
      <div className="section-title">
        <span>Puntas de fantasía</span>
        <Toggle on={hair.tipsOn} onChange={(v) => set({ tipsOn: v })} label="Puntas de color" />
      </div>
      {hair.tipsOn && <Swatches colors={HAIR_COLORS} value={hair.tips} onPick={(c) => set({ tips: c })} label="Color de puntas" />}
      <div className="section-title">Brillo</div>
      <Slider value={hair.shine} onChange={(v) => set({ shine: v })} label="Brillo del pelo" />
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <motion.button
      role="switch"
      aria-checked={on}
      aria-label={label}
      whileTap={{ scale: 0.9 }}
      onClick={() => {
        audio.click()
        onChange(!on)
      }}
      style={{ width: 58, height: 34, borderRadius: 999, background: on ? 'linear-gradient(135deg,#ff7ac8,#ff2d8a)' : '#e9d3e3', position: 'relative', boxShadow: 'inset 0 2px 4px rgba(0,0,0,.12)' }}
    >
      <motion.span layout style={{ position: 'absolute', top: 4, left: on ? 28 : 4, width: 26, height: 26, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,.2)' }} />
    </motion.button>
  )
}

// ───────────────────── Maquillaje ─────────────────────

function MakeupPanel() {
  const m = useGame((s) => s.look.makeup)
  const setLook = useGame((s) => s.setLook)
  const set = (p: Partial<typeof m>) => setLook((l) => ({ ...l, makeup: { ...l.makeup, ...p } }))
  return (
    <div className="scroll" data-testid="makeup-panel">
      <div className="section-title">Sombra de ojos</div>
      <Swatches colors={EYESHADOW_COLORS} value={m.eyeshadow} onPick={(c) => set({ eyeshadow: c })} label="Sombra" />
      <Slider value={m.eyeshadowAmt} onChange={(v) => set({ eyeshadowAmt: v })} label="Intensidad de la sombra" />
      <div className="section-title">Delineado</div>
      <Chips options={LINERS} value={m.liner} onPick={(v) => set({ liner: v })} testid="liner" />
      <div style={{ height: 6 }} />
      <Swatches colors={LINER_COLORS} value={m.linerColor} onPick={(c) => set({ linerColor: c })} label="Color del delineado" />
      <div className="section-title">Pestañas</div>
      <Chips options={LASHES} value={m.lashes} onPick={(v) => set({ lashes: v })} testid="lashes" />
      <div className="section-title">Colorete</div>
      <Swatches colors={BLUSH_COLORS} value={m.blush} onPick={(c) => set({ blush: c })} label="Colorete" />
      <Slider value={m.blushAmt} onChange={(v) => set({ blushAmt: v })} label="Intensidad del colorete" />
      <div className="section-title">Iluminador</div>
      <Slider value={m.highlighter} onChange={(v) => set({ highlighter: v })} label="Iluminador" />
      <div className="section-title">Labios</div>
      <Swatches colors={LIP_COLORS} value={m.lips} onPick={(c) => set({ lips: c })} label="Labios" />
      <div style={{ height: 6 }} />
      <Chips options={LIP_FINISHES} value={m.lipFinish} onPick={(v) => set({ lipFinish: v })} testid="lipfinish" />
      <Slider value={m.lipAmt} onChange={(v) => set({ lipAmt: v })} label="Intensidad de los labios" />
      <div className="section-title">Pegatinas y gemas</div>
      <Chips options={FACE_GEMS} value={m.gems} onPick={(v) => set({ gems: v })} testid="gems" />
      <div style={{ height: 6 }} />
      <Swatches colors={GEM_COLORS} value={m.gemColor} onPick={(c) => set({ gemColor: c })} label="Color de las gemas" />
    </div>
  )
}

function NailsPanel() {
  const n = useGame((s) => s.look.nails)
  const setLook = useGame((s) => s.setLook)
  const set = (p: Partial<typeof n>) => setLook((l) => ({ ...l, nails: { ...l.nails, ...p } }))
  return (
    <div className="scroll" data-testid="nails-panel">
      <div className="section-title">Forma</div>
      <Chips options={NAIL_SHAPES} value={n.shape} onPick={(v) => set({ shape: v })} testid="nailshape" />
      <div className="section-title">Color</div>
      <Swatches colors={NAIL_COLORS} value={n.color} onPick={(c) => set({ color: c })} label="Esmalte" />
      <div className="section-title">Acabado</div>
      <Chips options={NAIL_FINISHES} value={n.finish} onPick={(v) => set({ finish: v })} testid="nailfinish" />
    </div>
  )
}

// ───────────────────── Pantalla ─────────────────────

const CAMS: { id: CamPreset; icon: IconName; label: string }[] = [
  { id: 'cuerpo', icon: 'body', label: 'Cuerpo entero' },
  { id: 'cara', icon: 'face', label: 'Cara' },
  { id: 'manos', icon: 'hand', label: 'Manos' },
  { id: 'pies', icon: 'foot', label: 'Pies' },
]

function ChallengeBanner() {
  const id = useGame((s) => s.challengeId)
  const start = useGame((s) => s.challengeStart)
  const submit = useGame((s) => s.submitChallenge)
  const timed = useGame((s) => s.timedChallenge)
  const ch = id ? CHALLENGE_BY_ID[id] : null
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  const left = ch?.timeLimit && timed ? Math.max(0, ch.timeLimit - Math.floor((now - start) / 1000)) : null
  const fired = useRef(false)
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true
      audio.fanfare()
      submit()
    }
  }, [left, submit])
  if (!ch) return null
  return (
    <motion.div className="glass" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ position: 'fixed', top: 'calc(var(--safe-t) + 66px)', left: 12, right: 72, padding: '8px 12px', zIndex: 24 }} data-testid="challenge-banner">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong className="display" style={{ fontSize: 17, color: 'var(--fuchsia)' }}>
          {ch.title}
        </strong>
        {left !== null && (
          <span className="chip" style={{ minHeight: 32, color: left < 15 ? '#e8243c' : 'var(--ink)' }} aria-live="polite">
            <Icon name="timer" /> {left}s
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.3 }}>
        Estilo: {ch.wantedTags.map(tagLabel).join(', ')} · Accesorios: {ch.minAccessories}+
      </div>
    </motion.div>
  )
}

export default function StudioScreen({ mode }: { mode: 'studio' | 'challenge' }) {
  const tab = useGame((s) => s.tab)
  const setTab = useGame((s) => s.setTab)
  const cam = useGame((s) => s.cam)
  const setCam = useGame((s) => s.setCam)
  const expression = useGame((s) => s.expression)
  const setExpression = useGame((s) => s.setExpression)
  const dollId = useGame((s) => s.look.dollId)
  const setDoll = useGame((s) => s.setDoll)
  const surprise = useGame((s) => s.surprise)
  const saveLook = useGame((s) => s.saveLook)
  const submit = useGame((s) => s.submitChallenge)
  const onboardingDone = useGame((s) => s.save.onboardingDone)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const [name, setName] = useState('')
  const sheet = useRef<HTMLDivElement>(null)
  const setView = useView((s) => s.set)
  const reporter = useCallback((b: number, r: number) => setView({ insetBottom: b, insetRight: r }), [setView])
  useInsetTop(mode === 'challenge' ? 130 : 112)
  useInsetReporter(sheet, reporter)
  const doll = DOLLS.find((d) => d.id === dollId)!
  useEffect(() => {
    // las miniaturas del resto del catálogo se generan en segundo plano
    const t = window.setTimeout(() => prefetchThumbs(ITEMS), 1500)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <>
      <TopBar title={mode === 'challenge' ? undefined : 'Estudio'}>
      </TopBar>
      {mode === 'challenge' && <ChallengeBanner />}
      <div className="side-tools" style={mode === 'challenge' ? { top: 'calc(var(--safe-t) + 136px)' } : undefined}>
        {CAMS.map((c) => (
          <IconBtn key={c.id} icon={c.icon} label={c.label} active={cam === c.id} onClick={() => setCam(c.id)} data-testid={`cam-${c.id}`} />
        ))}
        <IconBtn
          icon={expression === 'sonrisa' ? 'smile' : expression === 'guino' ? 'wink' : 'pout'}
          label="Cambiar expresión"
          onClick={() => setExpression(expression === 'sonrisa' ? 'guino' : expression === 'guino' ? 'seria' : 'sonrisa')}
          data-testid="expression"
        />
        <IconBtn
          icon="dice"
          label="Sorpréndeme"
          onClick={() => {
            audio.sparkle()
            surprise()
          }}
          data-testid="surprise"
        />
      </div>
      {mode === 'studio' && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileTap={{ scale: 0.95 }}
          className="glass row"
          onClick={() => (audio.click(), setPicking(true))}
          data-testid="doll-picker"
          aria-label={`Muñeca: ${doll.name}. Cambiar de muñeca`}
          style={{ position: 'fixed', left: 12, top: 'calc(var(--safe-t) + 66px)', padding: '4px 12px 4px 4px', zIndex: 22, maxWidth: 'calc(100% - 90px)', minHeight: 44, gap: 8 }}
        >
          <span style={{ width: 36, height: 36, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, #fff 0, ${doll.color} 70%)`, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 700 }}>{doll.name[0]}</span>
          <strong className="display" style={{ color: doll.color, fontSize: 18 }}>
            {doll.name}
          </strong>
          <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{doll.styleName}</span>
        </motion.button>
      )}
      <Modal open={picking} onClose={() => setPicking(false)} label="Elige muñeca">
        <h2>Elige muñeca</h2>
        <div className="stack">
          {DOLLS.map((d) => (
            <motion.button
              key={d.id}
              whileTap={{ scale: 0.97 }}
              className="glass"
              data-testid={`doll-${d.id}`}
              aria-pressed={d.id === dollId}
              onClick={() => {
                audio.sparkle()
                setDoll(d.id)
                setPicking(false)
              }}
              style={{ padding: 12, textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start', border: d.id === dollId ? `2px solid ${d.color}` : undefined }}
            >
              <span style={{ width: 48, height: 48, flex: 'none', borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, #fff 0, ${d.color} 70%)`, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 22 }}>{d.name[0]}</span>
              <span>
                <strong className="display" style={{ color: d.color, fontSize: 19 }}>
                  {d.name}
                </strong>{' '}
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>· {d.styleName}</span>
                <span style={{ display: 'block', fontSize: 14, lineHeight: 1.35, marginTop: 2 }}>{d.personality}</span>
                <em style={{ display: 'block', fontSize: 14, color: 'var(--ink-soft)', marginTop: 4 }}>{d.quote}</em>
              </span>
            </motion.button>
          ))}
        </div>
      </Modal>
      <motion.div ref={sheet} className="sheet glass" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 20 }} data-testid="editor-sheet">
        <div className="tabs" role="tablist" aria-label="Editar">
          {TABS.map((t) => (
            <motion.button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              whileTap={{ scale: 0.92 }}
              data-testid={`tab-${t.id}`}
              onClick={() => {
                audio.click()
                setTab(t.id)
              }}
            >
              <Icon name={t.icon} />
              {t.label}
            </motion.button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
            {tab === 'ropa' && <ClothesPanel />}
            {tab === 'pelo' && <HairPanel />}
            {tab === 'maquillaje' && <MakeupPanel />}
            {tab === 'unas' && <NailsPanel />}
          </motion.div>
        </AnimatePresence>
        <div className="row" style={{ padding: '6px 10px 10px', gap: 8 }}>
          {mode === 'studio' ? (
            <Btn style={{ flex: 1 }} onClick={() => setSaving(true)} data-testid="save-look">
              <Icon name="save" width={22} height={22} /> Guardar look
            </Btn>
          ) : (
            <Btn
              variant="gold"
              style={{ flex: 1 }}
              sound="sparkle"
              onClick={() => {
                audio.fanfare()
                submit()
              }}
              data-testid="submit-challenge"
            >
              <Icon name="star" width={22} height={22} /> Presentar al jurado
            </Btn>
          )}
        </div>
      </motion.div>
      <Modal open={saving} onClose={() => setSaving(false)} label="Guardar look">
        <h2>Guardar look</h2>
        <p>Ponle un nombre bonito a tu creación.</p>
        <input
          className="text-input"
          value={name}
          maxLength={24}
          placeholder="Por ejemplo: Atardecer en Ibiza"
          onChange={(e) => setName(e.target.value)}
          aria-label="Nombre del look"
          data-testid="look-name"
        />
        <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setSaving(false)}>
            Cancelar
          </Btn>
          <Btn
            sound="sparkle"
            data-testid="confirm-save"
            onClick={() => {
              const thumb = interaction.capture?.({ w: 180, h: 240, type: 'image/jpeg', quality: 0.75, post: false }) ?? undefined
              saveLook(name || `Look de ${doll.name}`, thumb)
              setName('')
              setSaving(false)
              useGame.getState().burstConfetti()
            }}
          >
            <Icon name="check" width={20} height={20} /> Guardar
          </Btn>
        </div>
      </Modal>
      {mode === 'studio' && !onboardingDone && <Onboarding />}
    </>
  )
}
