import Anthropic from '@anthropic-ai/sdk';

export const MODEL = 'claude-sonnet-4-20250514';
const MLB_BASE = 'https://statsapi.mlb.com/api/v1';

// ── MLB Stats API fetchers ────────────────────────────────────────────────────

async function mlbGet(path) {
  const res = await fetch(`${MLB_BASE}${path}`);
  return res.json();
}

export function fetchRecentSchedule(teamId) {
  const today = new Date().toISOString().split('T')[0];
  const seasonStart = `${new Date().getFullYear()}-03-01`;
  return mlbGet(
    `/schedule?teamId=${teamId}&season=${new Date().getFullYear()}&gameType=R&sportId=1` +
    `&startDate=${seasonStart}&endDate=${today}`
  );
}

function fetchHitting(teamId) {
  return mlbGet(
    `/teams/${teamId}/stats?season=${new Date().getFullYear()}&group=hitting&gameType=R&sportId=1`
  );
}

function fetchPitching(teamId) {
  return mlbGet(
    `/teams/${teamId}/stats?season=${new Date().getFullYear()}&group=pitching&gameType=R&sportId=1`
  );
}

function fetchProbablePitchers(teamId) {
  return mlbGet(
    `/schedule?teamId=${teamId}&season=${new Date().getFullYear()}&gameType=R&sportId=1` +
    `&hydrate=probablePitcher`
  );
}

function fetchStandings() {
  return mlbGet(`/standings?leagueId=103,104&season=${new Date().getFullYear()}&gameType=R`);
}

function fetchRoster(teamId) {
  return mlbGet(`/teams/${teamId}/roster?rosterType=active&season=${new Date().getFullYear()}`);
}

function fetchPlayerHittingStats(playerId) {
  return mlbGet(`/people/${playerId}/stats?stats=season&season=${new Date().getFullYear()}&group=hitting`);
}

function fetchPlayerPitchingStats(playerId) {
  return mlbGet(`/people/${playerId}/stats?stats=season&season=${new Date().getFullYear()}&group=pitching`);
}

function fetchInjuryRoster(teamId) {
  return mlbGet(`/teams/${teamId}/roster?rosterType=injuries&season=${new Date().getFullYear()}`);
}

function fetchSeasonSchedule(teamId, season) {
  return mlbGet(`/schedule?sportId=1&teamId=${teamId}&season=${season}&gameType=R`);
}

// ── Extractors ────────────────────────────────────────────────────────────────

function extractRecentGames(scheduleData, teamId, limit = 10) {
  const games = [];
  for (const date of scheduleData?.dates ?? []) {
    for (const game of date?.games ?? []) {
      if (game?.status?.abstractGameState !== 'Final') continue;
      const home = game.teams?.home;
      const away = game.teams?.away;
      const isHome = home?.team?.id === teamId;
      const mine = isHome ? home : away;
      const opp = isHome ? away : home;
      games.push({
        date: date.date,
        homeAway: isHome ? 'vs' : '@',
        opponent: opp?.team?.name ?? 'Unknown',
        venue: game?.venue?.name ?? 'TBD',
        myScore: mine?.score ?? 0,
        oppScore: opp?.score ?? 0,
        won: mine?.isWinner ?? false,
        record: mine?.leagueRecord
          ? `${mine.leagueRecord.wins}-${mine.leagueRecord.losses}`
          : null,
      });
    }
  }
  return games.slice(-limit);
}

function extractStatSplit(statsData) {
  return statsData?.stats?.[0]?.splits?.[0]?.stat ?? {};
}

function extractProbablePitcher(scheduleData, teamId) {
  for (const date of scheduleData?.dates ?? []) {
    for (const game of date?.games ?? []) {
      if (game?.status?.abstractGameState === 'Final') continue;
      const home = game.teams?.home;
      const away = game.teams?.away;
      const isHome = home?.team?.id === teamId;
      const mySide = isHome ? home : away;
      const oppSide = isHome ? away : home;
      const pitcher = mySide?.probablePitcher;
      return {
        id: pitcher?.id ?? null,
        name: pitcher?.fullName ?? 'TBD',
        date: date.date,
        opponent: oppSide?.team?.name ?? 'TBD',
        homeAway: isHome ? 'vs' : '@',
      };
    }
  }
  return null;
}

function extractStandings(standingsData, teamId) {
  for (const record of standingsData?.records ?? []) {
    const teamRecord = record.teamRecords?.find((r) => r.team?.id === teamId);
    if (!teamRecord) continue;
    return {
      division: record.division?.name ?? 'Unknown Division',
      teamRecords: record.teamRecords ?? [],
    };
  }
  return null;
}

function extractTopHitters(rosterData, statsMap, limit = 3) {
  return (rosterData?.roster ?? [])
    .filter((p) => p.position?.type !== 'Pitcher')
    .map((p) => {
      const stat = statsMap[p.person.id] ?? {};
      return {
        id: p.person.id,
        name: p.person.fullName,
        position: p.position?.abbreviation ?? '?',
        ops: parseFloat(stat.ops ?? '0'),
        avg: stat.avg ?? '.---',
        obp: stat.obp ?? '.---',
        slg: stat.slg ?? '.---',
        hr: stat.homeRuns ?? 0,
        rbi: stat.rbi ?? 0,
        gamesPlayed: stat.gamesPlayed ?? 0,
      };
    })
    .filter((p) => p.gamesPlayed > 0)
    .sort((a, b) => b.ops - a.ops)
    .slice(0, limit);
}

function extractInjuredList(injuryRoster) {
  return (injuryRoster?.roster ?? []).map((p) => ({
    name: p.person?.fullName ?? 'Unknown',
    status: p.status?.description ?? 'IL',
  }));
}

function extractH2HGames(scheduleDatas, team1Id, team2Id) {
  const games = [];
  for (const scheduleData of scheduleDatas) {
    for (const date of scheduleData?.dates ?? []) {
      for (const game of date?.games ?? []) {
        if (game?.status?.abstractGameState !== 'Final') continue;
        const homeId = game.teams?.home?.team?.id;
        const awayId = game.teams?.away?.team?.id;
        const isH2H =
          (homeId === team1Id && awayId === team2Id) ||
          (homeId === team2Id && awayId === team1Id);
        if (!isH2H) continue;
        const isTeam1Home = homeId === team1Id;
        const t1Side = isTeam1Home ? game.teams.home : game.teams.away;
        const t2Side = isTeam1Home ? game.teams.away : game.teams.home;
        games.push({
          date: date.date,
          team1Score: t1Side?.score ?? 0,
          team2Score: t2Side?.score ?? 0,
          team1Won: !!(t1Side?.isWinner),
        });
      }
    }
  }
  return games;
}

function buildH2HRecord(games) {
  if (!games.length) return null;
  const team1Wins = games.filter((g) => g.team1Won).length;
  const team2Wins = games.length - team1Wins;
  const t1Total = games.reduce((s, g) => s + g.team1Score, 0);
  const t2Total = games.reduce((s, g) => s + g.team2Score, 0);
  const sorted = [...games].sort((a, b) => b.date.localeCompare(a.date));
  return {
    team1Wins,
    team2Wins,
    total: games.length,
    team1AvgRuns: +(t1Total / games.length).toFixed(2),
    team2AvgRuns: +(t2Total / games.length).toFixed(2),
    lastFive: sorted.slice(0, 5).map((g) => (g.team1Won ? 'W' : 'L')),
  };
}

export function findGameInSchedule(scheduleData, team1Id, team2Id) {
  for (const date of scheduleData?.dates ?? []) {
    for (const game of date?.games ?? []) {
      if (game?.status?.abstractGameState === 'Final') continue;
      const homeId = game.teams?.home?.team?.id;
      const awayId = game.teams?.away?.team?.id;
      if (
        (homeId === team1Id && awayId === team2Id) ||
        (homeId === team2Id && awayId === team1Id)
      ) {
        return { gamePk: game.gamePk, date: date.date };
      }
    }
  }
  return null;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtRecord(games) {
  const w = games.filter((g) => g.won).length;
  return `${w}W-${games.length - w}L in last ${games.length} games`;
}

function fmtGames(games) {
  if (!games.length) return '  (no completed games found in date range)';
  return games.map((g) => {
    const rl = g.won ? 'W' : 'L';
    const rec = g.record ? ` | Season record: ${g.record}` : '';
    return `  ${g.date}  ${rl} ${g.myScore}-${g.oppScore}  ${g.homeAway} ${g.opponent} (${g.venue})${rec}`;
  }).join('\n');
}

function fmtHitting(s) {
  if (!s.avg) return '  (no hitting stats available yet)';
  return [
    `  AVG: ${s.avg} | OBP: ${s.obp} | SLG: ${s.slg} | OPS: ${s.ops}`,
    `  HR: ${s.homeRuns} | RBI: ${s.rbi} | R: ${s.runs} | H: ${s.hits}`,
    `  2B: ${s.doubles} | 3B: ${s.triples} | SB: ${s.stolenBases}`,
    `  BB: ${s.baseOnBalls} | K: ${s.strikeOuts} | GP: ${s.gamesPlayed}`,
  ].join('\n');
}

function fmtPitching(s) {
  if (!s.era) return '  (no pitching stats available yet)';
  return [
    `  ERA: ${s.era} | WHIP: ${s.whip} | K: ${s.strikeOuts} | K/BB: ${s.strikeoutWalkRatio ?? 'n/a'}`,
    `  W-L: ${s.wins}-${s.losses} | SV: ${s.saves} | IP: ${s.inningsPitched}`,
    `  HR allowed: ${s.homeRuns} | BB: ${s.baseOnBalls} | H/9: ${s.hitsPer9Inn ?? 'n/a'}`,
  ].join('\n');
}

function fmtProbable(pitcher) {
  if (!pitcher) return '  (no upcoming game found)';
  return `  ${pitcher.name} — next game ${pitcher.homeAway} ${pitcher.opponent} on ${pitcher.date}`;
}

function fmtStandings(standing) {
  if (!standing) return '  (standings not available)';
  const rows = standing.teamRecords
    .sort((a, b) => Number(a.divisionRank) - Number(b.divisionRank))
    .map((r) => {
      const gb = r.divisionGamesBack === '-' ? 'LEAD' : `${r.divisionGamesBack} GB`;
      const streak = r.streak?.streakCode ?? '';
      return `  ${r.divisionRank}. ${r.team.name}  ${r.wins}-${r.losses} (.${Math.round(r.winningPercentage * 1000)})  ${gb}  ${streak ? `Str: ${streak}` : ''}`.trimEnd();
    });
  return `  ${standing.division}:\n${rows.join('\n')}`;
}

function fmtTopHitters(hitters) {
  if (!hitters.length) return '  (no individual hitting stats available yet)';
  return hitters.map((h, i) =>
    `  ${i + 1}. ${h.name} (${h.position}) — OPS: ${h.ops.toFixed(3)} | AVG: ${h.avg} | OBP: ${h.obp} | SLG: ${h.slg} | HR: ${h.hr} | RBI: ${h.rbi}`
  ).join('\n');
}

function fmtStartingPitcherStats(pitcher, stats) {
  if (!pitcher || pitcher.name === 'TBD') return '  TBD — no starting pitcher announced';
  if (!stats || !stats.era) return `  ${pitcher.name} — no ${new Date().getFullYear()} stats yet`;
  return `  ${pitcher.name} — ERA: ${stats.era} | WHIP: ${stats.whip} | K: ${stats.strikeOuts} | BB: ${stats.baseOnBalls} | IP: ${stats.inningsPitched} | W-L: ${stats.wins}-${stats.losses}`;
}

function fmtInjuries(injured) {
  if (!injured.length) return '  No current IL entries.';
  return injured.map((p) => `  ${p.name} — ${p.status}`).join('\n');
}

function fmtH2H(h2h, team1Name, team2Name) {
  if (!h2h) return '  (no head-to-head history found in last 3 seasons)';
  const badges = h2h.lastFive.map((r) => r).join('  ');
  const year = new Date().getFullYear();
  return [
    `  Record (${year - 2}–${year}): ${team1Name} ${h2h.team1Wins}W–${h2h.team2Wins}L out of ${h2h.total} games`,
    `  Avg runs scored — ${team1Name}: ${h2h.team1AvgRuns} | ${team2Name}: ${h2h.team2AvgRuns}`,
    `  Last 5 results (most recent first, from ${team1Name}'s view): ${badges}`,
  ].join('\n');
}

function buildMLBContext(
  team1Name, team1Games, team1Hitting, team1Pitching, team1Pitcher, team1Standing,
  team2Name, team2Games, team2Hitting, team2Pitching, team2Pitcher, team2Standing,
  team1TopHitters, team1PitcherStats, team2TopHitters, team2PitcherStats,
  team1Injured, team2Injured,
  h2h,
) {
  const standingsSection = team1Standing?.division === team2Standing?.division
    ? `  ${fmtStandings(team1Standing)}`
    : [fmtStandings(team1Standing), fmtStandings(team2Standing)].join('\n\n');

  return [
    `HEAD TO HEAD HISTORY — ${team1Name} vs ${team2Name}:`,
    fmtH2H(h2h, team1Name, team2Name),
    ``,
    `CURRENT STANDINGS:`,
    standingsSection,
    ``,
    `RECENT RESULTS — ${team1Name} (${fmtRecord(team1Games)}):`,
    fmtGames(team1Games),
    ``,
    `RECENT RESULTS — ${team2Name} (${fmtRecord(team2Games)}):`,
    fmtGames(team2Games),
    ``,
    `HITTING STATS — ${team1Name} (${new Date().getFullYear()} season, team totals):`,
    fmtHitting(team1Hitting),
    ``,
    `HITTING STATS — ${team2Name} (${new Date().getFullYear()} season, team totals):`,
    fmtHitting(team2Hitting),
    ``,
    `PITCHING STATS — ${team1Name} (${new Date().getFullYear()} season):`,
    fmtPitching(team1Pitching),
    ``,
    `PITCHING STATS — ${team2Name} (${new Date().getFullYear()} season):`,
    fmtPitching(team2Pitching),
    ``,
    `PROBABLE PITCHERS:`,
    `  ${team1Name}: ${fmtProbable(team1Pitcher)}`,
    `  ${team2Name}: ${fmtProbable(team2Pitcher)}`,
    ``,
    `PLAYER SPOTLIGHT — TOP HITTERS BY OPS — ${team1Name}:`,
    fmtTopHitters(team1TopHitters),
    ``,
    `PLAYER SPOTLIGHT — TOP HITTERS BY OPS — ${team2Name}:`,
    fmtTopHitters(team2TopHitters),
    ``,
    `STARTING PITCHER STATS — ${team1Name}:`,
    fmtStartingPitcherStats(team1Pitcher, team1PitcherStats),
    ``,
    `STARTING PITCHER STATS — ${team2Name}:`,
    fmtStartingPitcherStats(team2Pitcher, team2PitcherStats),
    ``,
    `INJURY REPORT — ${team1Name}:`,
    fmtInjuries(team1Injured),
    ``,
    `INJURY REPORT — ${team2Name}:`,
    fmtInjuries(team2Injured),
  ].join('\n');
}

// ── Verdict parser ────────────────────────────────────────────────────────────

export function parseVerdict(text) {
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
        typeof parsed.predictedScore === 'string'
      ) return parsed;
    } catch { /* try next */ }
  }
  return null;
}

// ── Streaming helper ──────────────────────────────────────────────────────────

async function runStage(client, send, stage, params) {
  let fullText = '';
  const anthropicStream = client.messages.stream(params);
  for await (const event of anthropicStream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
      send({ type: 'delta', stage, text: event.delta.text });
    }
  }
  return fullText;
}

// ── Core prediction engine ────────────────────────────────────────────────────
// send defaults to a no-op so cron callers don't need to wire up streaming.

export async function predictGame({ team1Id, team1Name, team2Id, team2Name, send = () => {} }) {
  const year = new Date().getFullYear();

  // Phase 1: 16 parallel fetches
  const [
    sched1, hit1, pitch1, prob1,
    sched2, hit2, pitch2, prob2,
    standings,
    roster1, roster2,
    injuryRoster1, injuryRoster2,
    h2hSched0, h2hSched1, h2hSched2,
  ] = await Promise.all([
    fetchRecentSchedule(team1Id),
    fetchHitting(team1Id),
    fetchPitching(team1Id),
    fetchProbablePitchers(team1Id),
    fetchRecentSchedule(team2Id),
    fetchHitting(team2Id),
    fetchPitching(team2Id),
    fetchProbablePitchers(team2Id),
    fetchStandings(),
    fetchRoster(team1Id),
    fetchRoster(team2Id),
    fetchInjuryRoster(team1Id),
    fetchInjuryRoster(team2Id),
    fetchSeasonSchedule(team1Id, year),
    fetchSeasonSchedule(team1Id, year - 1),
    fetchSeasonSchedule(team1Id, year - 2),
  ]);

  const team1Games    = extractRecentGames(sched1, team1Id);
  const team1Hitting  = extractStatSplit(hit1);
  const team1Pitching = extractStatSplit(pitch1);
  const team1Pitcher  = extractProbablePitcher(prob1, team1Id);
  const team1Standing = extractStandings(standings, team1Id);

  const team2Games    = extractRecentGames(sched2, team2Id);
  const team2Hitting  = extractStatSplit(hit2);
  const team2Pitching = extractStatSplit(pitch2);
  const team2Pitcher  = extractProbablePitcher(prob2, team2Id);
  const team2Standing = extractStandings(standings, team2Id);

  const team1Injured = extractInjuredList(injuryRoster1);
  const team2Injured = extractInjuredList(injuryRoster2);

  const h2hGames  = extractH2HGames([h2hSched0, h2hSched1, h2hSched2], team1Id, team2Id);
  const h2hRecord = buildH2HRecord(h2hGames);
  const nextGame  = findGameInSchedule(h2hSched0, team1Id, team2Id);

  // Phase 2: individual player stats
  const team1HitterIds = (roster1?.roster ?? [])
    .filter((p) => p.position?.type !== 'Pitcher')
    .map((p) => p.person.id);
  const team2HitterIds = (roster2?.roster ?? [])
    .filter((p) => p.position?.type !== 'Pitcher')
    .map((p) => p.person.id);
  const allHitterIds = [...team1HitterIds, ...team2HitterIds];

  const [hitterStatsResults, team1PitcherRaw, team2PitcherRaw] = await Promise.all([
    Promise.all(allHitterIds.map((id) => fetchPlayerHittingStats(id).catch(() => null))),
    team1Pitcher?.id ? fetchPlayerPitchingStats(team1Pitcher.id).catch(() => null) : Promise.resolve(null),
    team2Pitcher?.id ? fetchPlayerPitchingStats(team2Pitcher.id).catch(() => null) : Promise.resolve(null),
  ]);

  const hitterStatsMap = {};
  allHitterIds.forEach((id, i) => {
    const stat = hitterStatsResults[i]?.stats?.[0]?.splits?.[0]?.stat ?? null;
    if (stat) hitterStatsMap[id] = stat;
  });

  const team1TopHitters  = extractTopHitters(roster1, hitterStatsMap);
  const team2TopHitters  = extractTopHitters(roster2, hitterStatsMap);
  const team1PitcherStats = team1PitcherRaw?.stats?.[0]?.splits?.[0]?.stat ?? null;
  const team2PitcherStats = team2PitcherRaw?.stats?.[0]?.splits?.[0]?.stat ?? null;

  // Emit metadata event (no-op for cron callers)
  send({
    type: 'metadata',
    injuries: { team1: team1Injured, team2: team2Injured },
    playerSpotlight: {
      team1: {
        hitters: team1TopHitters,
        pitcher: { name: team1Pitcher?.name ?? 'TBD', stats: team1PitcherStats },
      },
      team2: {
        hitters: team2TopHitters,
        pitcher: { name: team2Pitcher?.name ?? 'TBD', stats: team2PitcherStats },
      },
    },
    h2h: h2hRecord,
    nextGameId: nextGame?.gamePk ?? null,
    nextGameDate: nextGame?.date ?? null,
  });

  const mlbContext = buildMLBContext(
    team1Name, team1Games, team1Hitting, team1Pitching, team1Pitcher, team1Standing,
    team2Name, team2Games, team2Hitting, team2Pitching, team2Pitcher, team2Standing,
    team1TopHitters, team1PitcherStats, team2TopHitters, team2PitcherStats,
    team1Injured, team2Injured,
    h2hRecord,
  );

  const groundTruthInstruction =
    `The following is live ${year} MLB data from the official MLB Stats API. ` +
    'Treat this as ground truth — use ONLY this data. ' +
    'When making arguments, reference specific numbers from the data: ' +
    'ERA, WHIP, batting average, OPS, individual player stats, injury impacts, recent win/loss record, head-to-head history, probable pitcher, standings position. ' +
    'Do not rely on your training data for any statistics or recent results.';

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  send({ type: 'stage_start', stage: 1, label: `Analyst 1 making the case for ${team1Name}…` });
  const arg1 = await runStage(client, send, 1, {
    model: MODEL,
    max_tokens: 1024,
    system: `${groundTruthInstruction} You are a passionate baseball analyst who believes ${team1Name} will win. Cite specific stats — ERA, WHIP, OPS, top hitter names and their numbers, injury advantages, recent form — to make the strongest possible case for them and expose weaknesses in ${team2Name}.`,
    messages: [{ role: 'user', content: `${mlbContext}\n\nMake the strongest possible case for ${team1Name} beating ${team2Name}. Name specific players, cite their actual ${year} stats, and highlight any injury advantages.` }],
  });
  send({ type: 'stage_done', stage: 1 });

  send({ type: 'stage_start', stage: 2, label: `Analyst 2 making the case for ${team2Name}…` });
  const arg2 = await runStage(client, send, 2, {
    model: MODEL,
    max_tokens: 1024,
    system: `${groundTruthInstruction} You are a passionate baseball analyst who believes ${team2Name} will win. Cite specific stats — ERA, WHIP, OPS, top hitter names and their numbers, injury advantages, recent form — to make the strongest possible case for them and expose weaknesses in ${team1Name}.`,
    messages: [{ role: 'user', content: `${mlbContext}\n\nMake the strongest possible case for ${team2Name} beating ${team1Name}. Name specific players, cite their actual ${year} stats, and highlight any injury advantages.` }],
  });
  send({ type: 'stage_done', stage: 2 });

  send({ type: 'stage_start', stage: 3, label: "Devil's Advocate challenging both sides…" });
  const arg3 = await runStage(client, send, 3, {
    model: MODEL,
    max_tokens: 1024,
    system: `${groundTruthInstruction} You are a Devil's Advocate. Challenge both arguments rigorously — find stats that contradict each case, highlight sample size issues, question overstated injury impacts, identify ignored matchup factors, and expose overstated claims.`,
    messages: [{
      role: 'user',
      content: [
        mlbContext,
        `\nArgument for ${team1Name}:\n${arg1}`,
        `\nArgument for ${team2Name}:\n${arg2}`,
        '\nChallenge both arguments using the data. What numbers undermine each case? Are the injury impacts overstated or understated?',
      ].join('\n'),
    }],
  });
  send({ type: 'stage_done', stage: 3 });

  send({ type: 'stage_start', stage: 4, label: 'Head Analyst delivering the final verdict…' });
  const stage4Text = await runStage(client, send, 4, {
    model: MODEL,
    max_tokens: 1500,
    system: `${groundTruthInstruction} You are the Head Analyst. Synthesise all three analyses into a definitive verdict. You MUST respond with ONLY a valid JSON object — no markdown fences, no preamble, no text outside the JSON:\n{"winner":"Team Name","confidence":70,"keyFactors":["factor 1","factor 2","factor 3"],"predictedScore":"4-2","summary":"One complete paragraph (2-4 sentences) that a baseball fan would enjoy. Must end with a full stop.","keyMatchups":[{"title":"Player A vs Pitcher B","detail":"Specific ${year} stats and why this matchup is decisive.","edge":"Team Name"},{"title":"Second key matchup","detail":"Specific stats and context.","edge":"Team Name"}]}`,
    messages: [{
      role: 'user',
      content: [
        mlbContext,
        `\nArgument for ${team1Name}:\n${arg1}`,
        `\nArgument for ${team2Name}:\n${arg2}`,
        `\nDevil's Advocate critique:\n${arg3}`,
        `\nDeliver your final verdict on ${team1Name} vs ${team2Name}. In keyMatchups, name 2-3 specific players from the PLAYER SPOTLIGHT data with their actual ${year} stats.`,
      ].join('\n'),
    }],
  });
  send({ type: 'stage_done', stage: 4 });

  const verdict = parseVerdict(stage4Text);
  return { verdict, nextGame };
}
