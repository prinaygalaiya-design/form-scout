'use client';

import { useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Team = { id: number; name: string; abbreviation: string };

type StageState = { label: string; text: string; done: boolean };

type KeyMatchup = { title: string; detail: string; edge: string };

type Verdict = {
  winner: string;
  confidence: number;
  keyFactors: string[];
  predictedScore: string;
  summary: string;
  keyMatchups?: KeyMatchup[];
};

type InjuryEntry = { name: string; status: string };
type InjuryInfo = { team1: InjuryEntry[]; team2: InjuryEntry[] };

type PlayerHitter = {
  id: number;
  name: string;
  position: string;
  ops: number;
  avg: string;
  hr: number;
  rbi: number;
  gamesPlayed: number;
};

type PitcherInfo = {
  name: string;
  stats: { era?: string; whip?: string; strikeOuts?: number; inningsPitched?: string; wins?: number; losses?: number } | null;
};

type TeamSpotlight = { hitters: PlayerHitter[]; pitcher: PitcherInfo };
type SpotlightData = { team1: TeamSpotlight; team2: TeamSpotlight };

type H2HRecord = {
  team1Wins: number;
  team2Wins: number;
  total: number;
  team1AvgRuns: number;
  team2AvgRuns: number;
  lastFive: ('W' | 'L')[];
};

type SavedPrediction = {
  id: string;
  date: string;
  team1Id: number;
  team2Id: number;
  team1Name: string;
  team2Name: string;
  predictedWinner: string;
  predictedScore: string;
  confidence: number;
  gameId: number | null;
  gameDate: string | null;
  actualWinner?: string;
  actualScore?: string;
  correct?: boolean;
  checked?: boolean;
};

// ── DB helpers ────────────────────────────────────────────────────────────────

async function fetchPredictionsFromDB(): Promise<SavedPrediction[]> {
  try {
    const res = await fetch('/api/predictions');
    const data = await res.json();
    return data.predictions ?? [];
  } catch {
    return [];
  }
}

// ── JSON parsing ──────────────────────────────────────────────────────────────

function parseVerdict(text: string): Verdict | null {
  const attempts = [
    () => text.trim(),
    () => { const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/); return m?.[1] ?? null; },
    () => { const m = text.match(/\{[\s\S]*\}/); return m?.[0] ?? null; },
  ];
  for (const attempt of attempts) {
    try {
      const src = attempt();
      if (!src) continue;
      const parsed = JSON.parse(src);
      if (
        typeof parsed.winner === 'string' &&
        typeof parsed.confidence === 'number' &&
        Array.isArray(parsed.keyFactors) &&
        typeof parsed.predictedScore === 'string' &&
        typeof parsed.summary === 'string'
      ) return parsed as Verdict;
    } catch { /* try next */ }
  }
  return null;
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-500 mb-3">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="h-px bg-slate-800 my-5" />;
}

// ── Team logo ─────────────────────────────────────────────────────────────────

function TeamLogo({ teamId, size = 48 }: { teamId: number | null; size?: number }) {
  if (!teamId) {
    return (
      <div
        className="rounded-full bg-slate-700 border border-slate-600 shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-white shrink-0 shadow-md overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <img
        src={`https://www.mlbstatic.com/team-logos/${teamId}.svg`}
        alt=""
        width={Math.round(size * 0.82)}
        height={Math.round(size * 0.82)}
        onError={(e) => {
          const parent = e.currentTarget.parentElement;
          if (parent) parent.style.background = '#334155';
          e.currentTarget.style.display = 'none';
        }}
      />
    </div>
  );
}

// ── Head to Head card ─────────────────────────────────────────────────────────

function H2HCard({ h2h, team1Name, team2Name, team1Id, team2Id }: {
  h2h: H2HRecord;
  team1Name: string;
  team2Name: string;
  team1Id: number | null;
  team2Id: number | null;
}) {
  const team1Pct = h2h.total > 0 ? h2h.team1Wins / h2h.total : 0.5;

  return (
    <div className="w-full max-w-2xl bg-slate-800/50 rounded-2xl border border-slate-700/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/40 bg-slate-800/60">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-slate-500">Head to Head</p>
        <p className="text-[10px] text-slate-600">{h2h.total} games · 2024–2026</p>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Record row */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 flex-1 justify-end">
            <div className="text-right">
              <p className="text-xl font-black text-white">{h2h.team1Wins}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">wins</p>
            </div>
            <TeamLogo teamId={team1Id} size={36} />
          </div>
          <div className="text-slate-600 font-bold text-sm shrink-0">—</div>
          <div className="flex items-center gap-2.5 flex-1">
            <TeamLogo teamId={team2Id} size={36} />
            <div>
              <p className="text-xl font-black text-white">{h2h.team2Wins}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">wins</p>
            </div>
          </div>
        </div>

        {/* Dominance bar */}
        <div>
          <div className="flex justify-between text-[10px] text-slate-600 mb-1.5">
            <span>{team1Name}</span>
            <span>{team2Name}</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all"
              style={{ width: `${team1Pct * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>{Math.round(team1Pct * 100)}%</span>
            <span>{Math.round((1 - team1Pct) * 100)}%</span>
          </div>
        </div>

        {/* Last 5 + avg runs */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[9px] font-bold tracking-widest uppercase text-slate-600 mb-2">Last 5 results</p>
            <div className="flex gap-1.5">
              {h2h.lastFive.map((r, i) => (
                <span
                  key={i}
                  className={`text-xs font-black w-6 h-6 flex items-center justify-center rounded ${
                    r === 'W'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                      : 'bg-red-500/15 text-red-400 border border-red-500/25'
                  }`}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold tracking-widest uppercase text-slate-600 mb-1">Avg runs</p>
            <p className="text-xs text-slate-300 font-mono">
              <span className="text-cyan-400 font-bold">{h2h.team1AvgRuns}</span>
              <span className="text-slate-600 mx-1">·</span>
              <span className="text-violet-400 font-bold">{h2h.team2AvgRuns}</span>
            </p>
            <p className="text-[9px] text-slate-600 mt-0.5">{team1Name} · {team2Name}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Confidence bar ────────────────────────────────────────────────────────────

function ConfidenceBar({ team1Name, team2Name, team1Id, team2Id, winner, confidence }: {
  team1Name: string;
  team2Name: string;
  team1Id: number | null;
  team2Id: number | null;
  winner: string;
  confidence: number;
}) {
  const team1Wins = winner === team1Name;
  // 0% from left = Team1's side; 100% = Team2's side
  // Team1 wins 70% → marker at 30% from left (70% toward Team1's left side)
  const markerLeft = team1Wins ? 100 - confidence : confidence;

  return (
    <div className="mt-5">
      {/* Team names */}
      <div className="flex justify-between text-xs font-bold mb-3">
        <span className={team1Wins ? 'text-cyan-400' : 'text-slate-600'}>{team1Name}</span>
        <span className={!team1Wins ? 'text-cyan-400' : 'text-slate-600'}>{team2Name}</span>
      </div>
      {/* Logos + bar row */}
      <div className="flex items-center gap-2.5">
        <TeamLogo teamId={team1Id} size={48} />
        <div className="flex-1 relative">
          <div className="relative h-2.5 rounded-full bg-gradient-to-r from-cyan-500 via-slate-600 to-violet-500 overflow-visible">
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-[3px] border-slate-900 shadow-[0_0_0_2px_rgba(6,182,212,0.6)] z-10"
              style={{ left: `${markerLeft}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] mt-2">
            <span className={team1Wins ? 'text-cyan-400 font-semibold' : 'text-slate-600'}>
              {team1Wins ? `${confidence}% confidence` : `${100 - confidence}%`}
            </span>
            <span className={!team1Wins ? 'text-cyan-400 font-semibold' : 'text-slate-600'}>
              {!team1Wins ? `${confidence}% confidence` : `${100 - confidence}%`}
            </span>
          </div>
        </div>
        <TeamLogo teamId={team2Id} size={48} />
      </div>
    </div>
  );
}

// ── Player spotlight ──────────────────────────────────────────────────────────

function HitterRow({ hitter, rank }: { hitter: PlayerHitter; rank: number }) {
  const opsBar = Math.min((hitter.ops / 1.15) * 100, 100);
  const barColor =
    hitter.ops >= 0.85 ? 'bg-cyan-500' :
    hitter.ops >= 0.70 ? 'bg-amber-500' :
    'bg-slate-600';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono text-slate-600 w-3 shrink-0">{rank}</span>
          <span className="text-sm font-semibold text-slate-200 truncate">{hitter.name}</span>
          <span className="text-[10px] text-slate-600 shrink-0">{hitter.position}</span>
        </div>
        <span className="text-[11px] font-mono font-bold text-cyan-400 shrink-0">
          OPS {hitter.ops.toFixed(3)}
        </span>
      </div>
      <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${opsBar}%` }} />
      </div>
      <p className="text-[10px] text-slate-600">
        AVG {hitter.avg} &nbsp;·&nbsp; {hitter.hr} HR &nbsp;·&nbsp; {hitter.rbi} RBI
      </p>
    </div>
  );
}

function TeamSpotlightColumn({ teamName, spotlight }: { teamName: string; spotlight: TeamSpotlight }) {
  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 space-y-4">
      <p className="text-[10px] font-bold tracking-widest uppercase text-cyan-500/80">{teamName}</p>

      {/* Probable starter */}
      {spotlight.pitcher.name !== 'TBD' && (
        <div className="pb-3 border-b border-slate-700/60">
          <p className="text-[9px] font-bold tracking-widest uppercase text-slate-600 mb-1">Starter</p>
          <p className="text-sm font-bold text-slate-200">{spotlight.pitcher.name}</p>
          {spotlight.pitcher.stats?.era ? (
            <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
              ERA {spotlight.pitcher.stats.era} &nbsp;·&nbsp; WHIP {spotlight.pitcher.stats.whip ?? '—'} &nbsp;·&nbsp; {spotlight.pitcher.stats.strikeOuts ?? 0} K
            </p>
          ) : (
            <p className="text-[11px] text-slate-600 italic mt-0.5">No 2026 stats yet</p>
          )}
        </div>
      )}

      {/* Top hitters */}
      {spotlight.hitters.length === 0 ? (
        <p className="text-xs text-slate-600 italic">No individual stats available yet</p>
      ) : (
        <div className="space-y-3">
          {spotlight.hitters.map((h, i) => (
            <HitterRow key={h.id} hitter={h} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Expandable summary ────────────────────────────────────────────────────────

const SUMMARY_THRESHOLD = 240;

function ExpandableSummary({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > SUMMARY_THRESHOLD;
  const displayed = isLong && !expanded ? text.slice(0, SUMMARY_THRESHOLD).trimEnd() + '…' : text;
  return (
    <div>
      <p className="text-sm text-slate-400 leading-7">{displayed}</p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-xs text-cyan-600 hover:text-cyan-400 transition-colors"
        >
          {expanded ? 'Show less ↑' : 'Show more ↓'}
        </button>
      )}
    </div>
  );
}

// ── Key matchups ──────────────────────────────────────────────────────────────

function KeyMatchupsSection({ matchups }: { matchups: KeyMatchup[] }) {
  if (!matchups.length) return null;
  return (
    <div>
      <SectionLabel>Key Matchups</SectionLabel>
      <div className="space-y-2.5">
        {matchups.map((m, i) => (
          <div key={i} className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <p className="text-sm font-bold text-slate-200">{m.title}</p>
              <span className="shrink-0 text-[10px] font-bold tracking-wide bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                {m.edge}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-5">{m.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Injury section ────────────────────────────────────────────────────────────

function InjurySection({ injuries, team1Name, team2Name }: {
  injuries: InjuryInfo;
  team1Name: string;
  team2Name: string;
}) {
  const anyInjuries = injuries.team1.length > 0 || injuries.team2.length > 0;
  return (
    <div className={`rounded-xl border p-4 ${
      anyInjuries
        ? 'bg-red-500/5 border-red-500/20'
        : 'bg-emerald-500/5 border-emerald-500/20'
    }`}>
      <SectionLabel>
        <span className={anyInjuries ? 'text-red-400' : 'text-emerald-400'}>
          {anyInjuries ? '⚠ Injury Report' : '✓ Injury Report — Both Squads Healthy'}
        </span>
      </SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        {([
          { label: team1Name, list: injuries.team1 },
          { label: team2Name, list: injuries.team2 },
        ] as { label: string; list: InjuryEntry[] }[]).map(({ label, list }) => (
          <div key={label}>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
            {list.length === 0 ? (
              <p className="text-xs text-emerald-500 font-medium">✓ No IL entries</p>
            ) : (
              <ul className="space-y-1.5">
                {list.map((p, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="text-red-400 shrink-0 mt-px">●</span>
                    <span className="text-slate-300">
                      {p.name}
                      <span className="text-slate-600 ml-1">({p.status})</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Verdict card ──────────────────────────────────────────────────────────────

function VerdictCard({ verdict, team1Name, team2Name, team1Id, team2Id, injuries, spotlight }: {
  verdict: Verdict;
  team1Name: string;
  team2Name: string;
  team1Id: number | null;
  team2Id: number | null;
  injuries: InjuryInfo | null;
  spotlight: SpotlightData | null;
}) {
  const winnerTeamId = verdict.winner === team1Name ? team1Id : team2Id;

  return (
    /* gradient border wrapper */
    <div className="relative p-px rounded-2xl bg-gradient-to-br from-cyan-500/50 via-slate-700/10 to-violet-500/50 w-full max-w-2xl shadow-2xl shadow-cyan-500/10">
      <div className="bg-slate-900 rounded-2xl overflow-hidden">

        {/* ── Header band ── */}
        <div className="bg-slate-800/80 border-b border-slate-700/60 px-6 pt-5 pb-6">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500 mb-3">
            Head Analyst Verdict
          </p>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <TeamLogo teamId={winnerTeamId} size={64} />
              <div>
                <h2 className="text-3xl font-black text-white leading-none">{verdict.winner}</h2>
                <p className="text-sm text-slate-400 mt-1.5">
                  Predicted score&nbsp;
                  <span className="font-bold text-white font-mono">{verdict.predictedScore}</span>
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-3xl font-black text-cyan-400">{verdict.confidence}%</span>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">confidence</p>
            </div>
          </div>
          <ConfidenceBar
            team1Name={team1Name}
            team2Name={team2Name}
            team1Id={team1Id}
            team2Id={team2Id}
            winner={verdict.winner}
            confidence={verdict.confidence}
          />
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-6 space-y-5">

          {/* Summary */}
          <div>
            <SectionLabel>Analysis</SectionLabel>
            <ExpandableSummary text={verdict.summary} />
          </div>

          <Divider />

          {/* Key factors */}
          <div>
            <SectionLabel>Key Deciding Factors</SectionLabel>
            <ol className="space-y-2.5">
              {verdict.keyFactors.map((f, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="text-sm font-black text-cyan-500 font-mono shrink-0 w-5 pt-px">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm text-slate-300 leading-6">{f}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Key matchups */}
          {verdict.keyMatchups && verdict.keyMatchups.length > 0 && (
            <>
              <Divider />
              <KeyMatchupsSection matchups={verdict.keyMatchups} />
            </>
          )}

          {/* Player spotlight */}
          {spotlight && (
            <>
              <Divider />
              <div>
                <SectionLabel>Player Spotlight</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <TeamSpotlightColumn teamName={team1Name} spotlight={spotlight.team1} />
                  <TeamSpotlightColumn teamName={team2Name} spotlight={spotlight.team2} />
                </div>
              </div>
            </>
          )}

          {/* Injury report */}
          {injuries && (
            <>
              <Divider />
              <InjurySection injuries={injuries} team1Name={team1Name} team2Name={team2Name} />
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Progress steps ────────────────────────────────────────────────────────────

function ProgressSteps({ stages, loading, allDone, team1Name, team2Name }: {
  stages: StageState[];
  loading: boolean;
  allDone: boolean;
  team1Name: string;
  team2Name: string;
}) {
  if (!loading && !allDone) return null;

  const steps = [
    'Gathering live data',
    `Case for ${team1Name}`,
    `Case for ${team2Name}`,
    'Head analyst deliberating',
    'Verdict ready',
  ];

  // Which step index is currently the active (in-progress) one
  const activeIdx =
    stages.length === 0 ? 0 :
    !stages[0]?.done ? 1 :
    !stages[1]?.done ? 2 :
    !stages[3]?.done ? 3 :
    4;

  return (
    <div className="w-full max-w-2xl bg-slate-800/50 rounded-2xl border border-slate-700/60 p-5">
      <div className="flex items-start gap-0">
        {steps.map((step, i) => {
          const isDone = allDone || i < activeIdx;
          const isActive = !allDone && i === activeIdx;
          return (
            <div key={i} className="flex items-start flex-1 last:flex-none">
              {/* Step node + label */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isDone
                    ? 'bg-cyan-500 border-cyan-500 text-slate-900'
                    : isActive
                    ? 'bg-slate-700 border-cyan-400 text-cyan-400 animate-pulse'
                    : 'bg-slate-800 border-slate-700 text-slate-700'
                }`}>
                  {isDone ? '✓' : i + 1}
                </div>
                <span className={`text-[10px] text-center leading-tight max-w-[64px] transition-colors ${
                  isDone ? 'text-cyan-400' : isActive ? 'text-slate-200' : 'text-slate-700'
                }`}>
                  {step}
                </span>
              </div>
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 mt-3.5 rounded-full transition-colors ${
                  isDone || allDone ? 'bg-cyan-500/40' : 'bg-slate-700'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Debate stage card ─────────────────────────────────────────────────────────

const DEBATE_STYLES = [
  { accent: 'text-blue-400',   border: 'border-blue-500/20',   bg: 'bg-blue-500/5',   dot: 'bg-blue-500'   },
  { accent: 'text-orange-400', border: 'border-orange-500/20', bg: 'bg-orange-500/5', dot: 'bg-orange-500' },
  { accent: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/5', dot: 'bg-purple-500' },
  { accent: 'text-emerald-400',border: 'border-emerald-500/20',bg: 'bg-emerald-500/5',dot: 'bg-emerald-500'},
];

function StageCard({ stage, index }: { stage: StageState; index: number }) {
  const s = DEBATE_STYLES[index];
  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} overflow-hidden`}>
      <div className={`flex items-center gap-2.5 px-4 py-3 border-b border-white/5`}>
        {stage.done
          ? <span className={`text-xs font-bold ${s.accent}`}>✓</span>
          : <span className={`w-2 h-2 rounded-full ${s.dot} animate-pulse`} />}
        <span className={`text-sm font-semibold ${s.accent}`}>{stage.label}</span>
      </div>
      <div className="px-4 py-4">
        <p className="text-sm text-slate-400 leading-7 whitespace-pre-wrap">
          {stage.text}
          {!stage.done && <span className="text-cyan-400 animate-pulse">▌</span>}
        </p>
      </div>
    </div>
  );
}

// ── Prediction history ────────────────────────────────────────────────────────

function CircularAccuracy({ correct, total }: { correct: number; total: number }) {
  const pct = total === 0 ? 0 : correct / total;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const filled = pct * circ;
  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#1e293b" strokeWidth="7" />
        <circle
          cx="40" cy="40" r={r}
          fill="none"
          stroke={pct >= 0.6 ? '#06b6d4' : pct >= 0.4 ? '#f59e0b' : '#ef4444'}
          strokeWidth="7"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-black text-white leading-none">
          {total === 0 ? '—' : `${Math.round(pct * 100)}%`}
        </span>
        <span className="text-[8px] text-slate-500 uppercase tracking-wider mt-0.5">acc</span>
      </div>
    </div>
  );
}

function PredictionCard({ pred }: { pred: SavedPrediction }) {
  const dateStr = new Date(pred.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  const isPending = !pred.checked;
  const hasFutureGame = pred.gameDate && pred.gameDate > new Date().toISOString().split('T')[0];

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-start justify-between gap-3">
        {/* Teams + prediction */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <TeamLogo teamId={pred.team1Id} size={24} />
            <span className="text-[9px] text-slate-600 font-bold">vs</span>
            <TeamLogo teamId={pred.team2Id} size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 mb-0.5">{dateStr}</p>
            <p className="text-sm font-bold text-white truncate">
              {pred.team1Name} vs {pred.team2Name}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Predicted: <span className="text-white font-semibold">{pred.predictedWinner}</span>
              <span className="text-slate-600 mx-1.5">·</span>
              <span className="font-mono">{pred.predictedScore}</span>
              <span className="text-slate-600 mx-1.5">·</span>
              <span className="text-cyan-400">{pred.confidence}%</span>
            </p>
            {pred.checked && (
              <p className="text-xs text-slate-500 mt-1">
                Actual: <span className={`font-semibold ${pred.correct ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pred.actualWinner}
                </span>
                {pred.actualScore && (
                  <span className="text-slate-600 ml-1 font-mono">({pred.actualScore})</span>
                )}
              </p>
            )}
            {isPending && !hasFutureGame && pred.gameId && (
              <p className="text-[10px] text-slate-600 mt-1 italic">Checking result…</p>
            )}
            {isPending && hasFutureGame && (
              <p className="text-[10px] text-slate-600 mt-1">
                Game scheduled {pred.gameDate}
              </p>
            )}
            {!pred.gameId && (
              <p className="text-[10px] text-slate-600 mt-1 italic">No upcoming game found</p>
            )}
          </div>
        </div>
        {/* Result badge */}
        {pred.checked ? (
          <span className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full border tracking-wider ${
            pred.correct
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              : 'bg-red-500/10 text-red-400 border-red-500/25'
          }`}>
            {pred.correct ? '✓ CORRECT' : '✗ WRONG'}
          </span>
        ) : (
          <span className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-slate-700/50 text-slate-500 border-slate-600 tracking-wider">
            PENDING
          </span>
        )}
      </div>
    </div>
  );
}

function PredictionHistorySection({ predictions }: { predictions: SavedPrediction[] }) {
  if (!predictions.length) return null;

  const checked = predictions.filter((p) => p.checked);
  const correct = checked.filter((p) => p.correct).length;

  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-slate-500">
            Prediction History
          </p>
          <p className="text-xs text-slate-600 mt-0.5">{predictions.length} prediction{predictions.length !== 1 ? 's' : ''}</p>
        </div>
        <CircularAccuracy correct={correct} total={checked.length} />
      </div>

      {/* Stats bar */}
      {checked.length > 0 && (
        <div className="flex gap-4 bg-slate-800/50 rounded-xl border border-slate-700/50 px-5 py-3">
          <div className="text-center">
            <p className="text-lg font-black text-emerald-400">{correct}</p>
            <p className="text-[9px] text-slate-600 uppercase tracking-wider">correct</p>
          </div>
          <div className="w-px bg-slate-700 self-stretch" />
          <div className="text-center">
            <p className="text-lg font-black text-red-400">{checked.length - correct}</p>
            <p className="text-[9px] text-slate-600 uppercase tracking-wider">wrong</p>
          </div>
          <div className="w-px bg-slate-700 self-stretch" />
          <div className="text-center">
            <p className="text-lg font-black text-slate-400">{predictions.length - checked.length}</p>
            <p className="text-[9px] text-slate-600 uppercase tracking-wider">pending</p>
          </div>
          <div className="flex-1" />
          <div className="text-right self-center">
            <p className="text-sm font-black text-cyan-400">
              {checked.length > 0 ? `${Math.round((correct / checked.length) * 100)}%` : '—'}
            </p>
            <p className="text-[9px] text-slate-600 uppercase tracking-wider">accuracy</p>
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="space-y-2.5">
        {predictions.map((pred) => (
          <PredictionCard key={pred.id} pred={pred} />
        ))}
      </div>
    </div>
  );
}

// ── Team card ─────────────────────────────────────────────────────────────────

function TeamCard({ team, value, teams, onChange, label }: {
  team: Team | undefined;
  value: number | null;
  teams: Team[];
  onChange: (id: number) => void;
  label: string;
}) {
  return (
    <div className="flex-1 bg-slate-800/70 rounded-2xl border border-slate-700/60 p-5 flex flex-col gap-4 hover:border-slate-600 transition-colors">
      <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-600">{label}</p>
      <div className="flex items-center gap-3">
        <TeamLogo teamId={team?.id ?? null} size={48} />
        <p className="text-base font-bold text-white leading-tight">
          {team?.name ?? 'Select a team'}
        </p>
      </div>
      {/* Custom styled select */}
      <div className="relative">
        <select
          className="w-full appearance-none bg-slate-700/80 border border-slate-600 text-slate-200 text-sm rounded-xl pl-3 pr-8 py-2.5 focus:outline-none focus:border-cyan-500/60 cursor-pointer transition-colors"
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id} className="bg-slate-800">
              {t.name}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">
          ▾
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [team1Id, setTeam1Id] = useState<number | null>(null);
  const [team2Id, setTeam2Id] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [stages, setStages] = useState<StageState[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [verdictRaw, setVerdictRaw] = useState<string | null>(null);
  const [injuries, setInjuries] = useState<InjuryInfo | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightData | null>(null);
  const [h2h, setH2H] = useState<H2HRecord | null>(null);
  const [predictions, setPredictions] = useState<SavedPrediction[]>([]);
  const [showDebate, setShowDebate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref holds next-game info captured from the metadata event during streaming
  const nextGameRef = useRef<{ id: number | null; date: string | null }>({ id: null, date: null });

  useEffect(() => {
    fetch('/api/teams')
      .then((r) => r.json())
      .then((data) => {
        const list: Team[] = data.teams ?? [];
        setTeams(list);
        if (list.length >= 2) { setTeam1Id(list[0].id); setTeam2Id(list[1].id); }
      })
      .catch(() => setError('Failed to load teams'))
      .finally(() => setTeamsLoading(false));
  }, []);

  // On mount: fetch predictions from the global database
  useEffect(() => {
    fetchPredictionsFromDB().then(setPredictions);
  }, []);

  const team1 = teams.find((t) => t.id === team1Id);
  const team2 = teams.find((t) => t.id === team2Id);
  const allDone = stages.length === 4 && stages.every((s) => s.done);

  async function handleGetPrediction() {
    if (!team1 || !team2) return;
    setLoading(true);
    setStages([]);
    setVerdict(null);
    setVerdictRaw(null);
    setInjuries(null);
    setSpotlight(null);
    setH2H(null);
    setShowDebate(false);
    setError(null);
    nextGameRef.current = { id: null, date: null };

    // Capture team objects in closure so they're stable across the async loop
    const t1 = team1;
    const t2 = team2;

    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team1Id: t1.id, team1Name: t1.name, team2Id: t2.id, team2Name: t2.name }),
      });

      if (!res.ok || !res.body) throw new Error(`Request failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);

          if (event.type === 'metadata') {
            if (event.injuries) setInjuries(event.injuries);
            if (event.playerSpotlight) setSpotlight(event.playerSpotlight);
            if (event.h2h) setH2H(event.h2h);
            if (event.nextGameId !== undefined) {
              nextGameRef.current = { id: event.nextGameId, date: event.nextGameDate ?? null };
            }
          } else if (event.type === 'stage_start') {
            setStages((prev) => [...prev, { label: event.label, text: '', done: false }]);
          } else if (event.type === 'delta') {
            setStages((prev) =>
              prev.map((s, i) => i === event.stage - 1 ? { ...s, text: s.text + event.text } : s)
            );
          } else if (event.type === 'stage_done') {
            setStages((prev) => {
              const updated = prev.map((s, i) => i === event.stage - 1 ? { ...s, done: true } : s);
              if (event.stage === 4) {
                const raw = updated[3]?.text ?? '';
                setVerdictRaw(raw);
                setVerdict(parseVerdict(raw));
              }
              return updated;
            });
          } else if (event.type === 'done') {
            // Refresh from DB so the new prediction (saved server-side) appears
            fetchPredictionsFromDB().then(setPredictions);
          } else if (event.type === 'error') {
            setError(event.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a]">

      {/* ── Header ── */}
      <header className="border-b border-slate-800 bg-[#0f172a]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">
              FORM SCOUT
            </h1>
            <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-cyan-400 mt-0.5">
              AI-Powered MLB Predictions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Live Data</span>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 flex flex-col items-center gap-8">

        {/* Team selection */}
        {teamsLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-8">
            <span className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
            Loading rosters…
          </div>
        ) : (
          <div className="w-full flex items-center gap-3">
            <TeamCard team={team1} value={team1Id} teams={teams} onChange={setTeam1Id} label="Home Team" />
            {/* VS badge */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-px h-6 bg-slate-700" />
              <div className="text-xs font-black text-slate-500 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg tracking-wider">
                VS
              </div>
              <div className="w-px h-6 bg-slate-700" />
            </div>
            <TeamCard team={team2} value={team2Id} teams={teams} onChange={setTeam2Id} label="Away Team" />
          </div>
        )}

        {/* Predict button */}
        <button
          onClick={handleGetPrediction}
          disabled={loading || teamsLoading || !team1Id || !team2Id}
          className={`
            w-full py-4 rounded-2xl font-black text-sm tracking-[0.12em] uppercase
            flex items-center justify-center gap-3
            transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
            ${loading
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20 animate-pulse'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-900 shadow-xl shadow-cyan-500/30 hover:shadow-cyan-400/40 hover:scale-[1.01] active:scale-[0.99]'
            }
          `}
        >
          <span className="text-lg">⚡</span>
          {loading ? 'Analysing…' : 'Get Prediction'}
        </button>

        {/* Error */}
        {error && (
          <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Progress steps */}
        <ProgressSteps
          stages={stages}
          loading={loading}
          allDone={allDone}
          team1Name={team1?.name ?? 'Team 1'}
          team2Name={team2?.name ?? 'Team 2'}
        />

        {/* H2H card — appears as soon as metadata arrives */}
        {h2h && (
          <H2HCard
            h2h={h2h}
            team1Name={team1?.name ?? ''}
            team2Name={team2?.name ?? ''}
            team1Id={team1?.id ?? null}
            team2Id={team2?.id ?? null}
          />
        )}

        {/* Verdict card */}
        {verdict && (
          <VerdictCard
            verdict={verdict}
            team1Name={team1?.name ?? ''}
            team2Name={team2?.name ?? ''}
            team1Id={team1?.id ?? null}
            team2Id={team2?.id ?? null}
            injuries={injuries}
            spotlight={spotlight}
          />
        )}

        {/* Fallback: stage 4 done but JSON parse failed */}
        {allDone && !verdict && verdictRaw && (
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 overflow-hidden">
            <div className="bg-slate-800 px-4 py-3 text-slate-300 text-sm font-semibold border-b border-slate-700">
              Head Analyst Verdict
            </div>
            <div className="bg-slate-800/50 px-4 py-4">
              <p className="text-sm text-slate-400 leading-7 whitespace-pre-wrap">{verdictRaw}</p>
            </div>
          </div>
        )}

        {/* Toggle */}
        {allDone && (
          <button
            onClick={() => setShowDebate((v) => !v)}
            className="text-sm text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1.5"
          >
            {showDebate ? 'Hide analyst debate ↑' : 'View full analyst debate ↓'}
          </button>
        )}

        {/* Full debate */}
        {showDebate && (
          <div className="flex flex-col gap-4 w-full">
            {stages.map((stage, i) => (
              <StageCard key={i} stage={stage} index={i} />
            ))}
          </div>
        )}

        {/* Divider before history */}
        {predictions.length > 0 && (
          <div className="w-full h-px bg-slate-800 my-2" />
        )}

        {/* Prediction history */}
        <PredictionHistorySection predictions={predictions} />

      </main>
    </div>
  );
}
