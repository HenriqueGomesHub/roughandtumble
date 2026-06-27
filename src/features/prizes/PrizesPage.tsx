import { useEffect, useState } from 'react'
import { Trophy, Gift, Calendar, type LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E`

interface Prize {
  id: string
  category: 'season' | 'watch_party' | 'weekly'
  rank: number | null
  title: string
  value_label: string
  description: string
  sort_order: number
}

// ── Season prizes ────────────────────────────────────────────────────────────

// 1st place — the featured navy hero card.
function SeasonHero({ prize }: { prize: Prize }) {
  return (
    <div className="relative overflow-hidden bg-navy border-4 border-navy shadow-[8px_8px_0_0_#E96630]">
      <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
      <div className="relative z-10 p-6 md:p-8 flex items-start gap-5">
        <div className="shrink-0 size-16 md:size-20 bg-persimmon flex flex-col items-center justify-center shadow-[3px_3px_0_0_#FFFFFF]">
          <Trophy size={26} className="text-white" strokeWidth={2.5} />
          <span className="font-display font-bold text-[10px] uppercase tracking-widest text-white mt-0.5">1st</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-[11px] uppercase tracking-[0.3em] text-persimmon">{prize.title}</p>
          <p className="font-display font-bold text-2xl md:text-4xl uppercase tracking-tight text-white leading-[1.1] mt-1.5 break-words">
            {prize.value_label}
          </p>
          {prize.description && (
            <p className="font-body text-sm text-white/60 leading-relaxed mt-3 max-w-prose">{prize.description}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// 2nd / 3rd place — paired white cards.
function SeasonCard({ prize }: { prize: Prize }) {
  return (
    <div className="bg-white border-2 border-navy shadow-[5px_5px_0_0_#232F49] p-5 md:p-6 flex items-start gap-4 h-full">
      <div className="shrink-0 size-12 md:size-14 bg-navy flex items-center justify-center">
        <span className="font-display font-bold text-xl md:text-2xl text-white tabular-nums">{prize.rank}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-[11px] uppercase tracking-[0.25em] text-navy/50">{prize.title}</p>
        <p className="font-display font-bold text-xl md:text-2xl uppercase tracking-tight text-navy leading-[1.15] mt-1 break-words">
          {prize.value_label}
        </p>
        {prize.description && (
          <p className="font-body text-sm text-navy/55 leading-relaxed mt-2">{prize.description}</p>
        )}
      </div>
    </div>
  )
}

// ── Bonus prizes (watch party / weekly) ────────────────────────────────────────

function BonusCard({ prize, icon: Icon, label }: { prize: Prize; icon: LucideIcon; label: string }) {
  return (
    <div className="bg-white border-2 border-navy border-t-[6px] border-t-persimmon shadow-[5px_5px_0_0_#232F49] p-5 md:p-6 flex flex-col h-full">
      <div className="flex items-center gap-2.5 mb-3">
        <Icon size={18} className="text-persimmon shrink-0" strokeWidth={2.5} />
        <p className="font-display font-bold text-[11px] uppercase tracking-[0.25em] text-navy/50">{label}</p>
      </div>
      <p className="font-display font-bold text-xl md:text-2xl uppercase tracking-tight text-navy leading-[1.15] break-words">
        {prize.value_label}
      </p>
      <p className="font-display font-bold text-[11px] uppercase tracking-widest text-persimmon mt-1.5">{prize.title}</p>
      {prize.description && (
        <p className="font-body text-sm text-navy/55 leading-relaxed mt-3">{prize.description}</p>
      )}
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-3 mb-5 md:mb-6">
      <Icon size={18} className="text-persimmon shrink-0" strokeWidth={2.5} />
      <h2 className="font-display font-bold text-base md:text-lg uppercase tracking-[0.2em] text-navy shrink-0">{label}</h2>
      <div className="flex-1 h-[2px] bg-navy/15" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="py-12 md:py-20 flex justify-center">
      <div className="w-full max-w-md py-16 px-8 flex flex-col items-center gap-6 bg-white border-4 border-navy border-dashed relative overflow-hidden shadow-[8px_8px_0_0_#232F49]">
        <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-10" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
        <Gift size={56} className="text-navy/20 relative z-10" strokeWidth={2} />
        <div className="text-center relative z-10">
          <p className="font-display text-2xl font-bold uppercase tracking-[0.2em] text-navy">Prizes coming soon</p>
          <p className="font-body text-sm text-navy/50 max-w-[280px] mx-auto mt-3 leading-relaxed">
            Prize details will be announced before the next game. Stay tuned!
          </p>
        </div>
      </div>
    </div>
  )
}

export function PrizesPage() {
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: seasonData } = await supabase
        .from('seasons').select('id').eq('is_active', true).limit(1).single()
      const season = seasonData as { id: string } | null
      if (!season) { setLoading(false); return }
      const { data } = await supabase
        .from('prizes')
        .select('id, category, rank, title, value_label, description, sort_order')
        .eq('season_id', season.id)
        .order('sort_order')
      setPrizes((data as Prize[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // De-duplicate by content, not id — the data has repeated rows with distinct ids.
  const seen = new Set<string>()
  const unique = prizes.filter(p => {
    const key = `${p.category}|${p.rank}|${p.title}|${p.value_label}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const season = unique.filter(p => p.category === 'season').sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
  const hero = season.find(p => p.rank === 1) ?? season[0] ?? null
  const restSeason = season.filter(p => p !== hero)
  const watchParty = unique.filter(p => p.category === 'watch_party')
  const weekly = unique.filter(p => p.category === 'weekly')
  const hasBonus = watchParty.length > 0 || weekly.length > 0

  return (
    <div style={{ animation: 'fade-up 0.25s ease-out' }} className="relative min-h-full">

      {/* ── Section header ────────────────────────────────────────────────── */}
      <div className="bg-navy px-4 md:px-8 lg:px-12 py-4 md:py-6 flex items-center gap-4 border-b-4 border-persimmon relative overflow-hidden shadow-md">
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30 z-0" style={{ backgroundImage: `url("${NOISE_SVG}")` }} />
        <div className="bg-persimmon p-1.5 shadow-[2px_2px_0_0_#FFF] relative z-10">
          <Gift size={16} className="text-white shrink-0" strokeWidth={2.5} />
        </div>
        <h1 className="font-display font-bold text-lg md:text-xl uppercase tracking-[0.2em] text-white relative z-10">Prizes</h1>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 lg:px-12 py-8 md:py-12 relative z-10 max-w-3xl mx-auto">
        {loading ? (
          <div className="space-y-10 animate-pulse" aria-busy="true">
            <div className="space-y-5">
              <div className="h-6 w-48 bg-navy/10" />
              <div className="h-32 bg-navy/10 border-2 border-navy/5" />
              <div className="grid sm:grid-cols-2 gap-5">
                {[1, 2].map(i => <div key={i} className="h-32 bg-navy/5 border-2 border-navy/10" />)}
              </div>
            </div>
          </div>
        ) : unique.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-10 md:space-y-12">

            {season.length > 0 && (
              <section aria-labelledby="prizes-season">
                <SectionHeader label="Season Prizes" icon={Trophy} />
                <div className="space-y-4 md:space-y-5">
                  {hero && <SeasonHero prize={hero} />}
                  {restSeason.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                      {restSeason.map(p => <SeasonCard key={p.id} prize={p} />)}
                    </div>
                  )}
                </div>
              </section>
            )}

            {hasBonus && (
              <section aria-labelledby="prizes-bonus">
                <SectionHeader label="More Ways to Win" icon={Gift} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                  {watchParty.map(p => <BonusCard key={p.id} prize={p} icon={Gift} label="Watch Party" />)}
                  {weekly.map(p => <BonusCard key={p.id} prize={p} icon={Calendar} label="This Week" />)}
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
