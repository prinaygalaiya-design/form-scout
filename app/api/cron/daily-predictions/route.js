import { predictGame } from '@/lib/predict-game';
import { ensureTable, savePrediction, predictionExistsForGame } from '@/lib/db';

const MLB_BASE = 'https://statsapi.mlb.com/api/v1';

export const maxDuration = 60;

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  await ensureTable();

  const today = new Date().toISOString().split('T')[0];

  // 1. Fetch today's MLB schedule
  let games;
  try {
    const scheduleUrl = `${MLB_BASE}/schedule?sportId=1&date=${today}&gameType=R`;
    console.log(`[daily-predictions] Fetching schedule: ${scheduleUrl}`);
    const res = await fetch(scheduleUrl);
    if (!res.ok) {
      throw new Error(`MLB schedule API ${res.status} ${res.statusText} — ${scheduleUrl}`);
    }
    const data = await res.json();
    games = (data?.dates?.[0]?.games ?? []).map((g) => ({
      gamePk: g.gamePk,
      gameDate: today,
      homeTeamId: g.teams?.home?.team?.id,
      homeTeamName: g.teams?.home?.team?.name,
      awayTeamId: g.teams?.away?.team?.id,
      awayTeamName: g.teams?.away?.team?.name,
    })).filter((g) => g.homeTeamId && g.awayTeamId);
    console.log(`[daily-predictions] ${games.length} game(s) found for ${today}`);
  } catch (err) {
    console.error('[daily-predictions] Failed to fetch schedule:', err.stack ?? err.message);
    return Response.json({ error: 'Failed to fetch MLB schedule', detail: err.message }, { status: 500 });
  }

  if (!games.length) {
    return Response.json({ message: 'No games scheduled today', predicted: 0, skipped: 0 });
  }

  // 2. Find the first game that doesn't have a prediction yet
  let target = null;
  let skipped = 0;
  for (const game of games) {
    try {
      const exists = await predictionExistsForGame(game.gamePk);
      if (exists) {
        skipped++;
        continue;
      }
      target = game;
      break;
    } catch (err) {
      console.error(`[daily-predictions] DB check failed for gamePk=${game.gamePk}:`, err.stack ?? err.message);
      return Response.json({ error: 'DB check failed', detail: err.message }, { status: 500 });
    }
  }

  if (!target) {
    console.log(`[daily-predictions] All ${games.length} game(s) already predicted for ${today}`);
    return Response.json({ message: 'All games already predicted', date: today, totalGames: games.length, skipped });
  }

  // 3. Predict the one target game
  const label = `${target.homeTeamName} vs ${target.awayTeamName} (gamePk=${target.gamePk})`;
  console.log(`[daily-predictions] Predicting ${label}`);

  try {
    const { verdict } = await predictGame({
      team1Id: target.homeTeamId,
      team1Name: target.homeTeamName,
      team2Id: target.awayTeamId,
      team2Name: target.awayTeamName,
    });

    if (!verdict) {
      console.error(`[daily-predictions] Verdict parse failed for ${label}`);
      return Response.json({ error: 'Claude response was not valid JSON', gamePk: target.gamePk }, { status: 500 });
    }

    const predId = `cron-${target.gamePk}-${Date.now()}`;
    await savePrediction({
      id: predId,
      team1: target.homeTeamName,
      team2: target.awayTeamName,
      team1Id: target.homeTeamId,
      team2Id: target.awayTeamId,
      predictedWinner: verdict.winner,
      confidence: verdict.confidence,
      predictedScore: verdict.predictedScore,
      gameDate: target.gameDate,
      gameId: target.gamePk,
    });

    console.log(`[daily-predictions] Done: ${label} → ${verdict.winner} wins (${verdict.confidence}%)`);
    return Response.json({
      date: today,
      totalGames: games.length,
      skipped,
      predicted: { gamePk: target.gamePk, label, winner: verdict.winner, confidence: verdict.confidence },
    });
  } catch (err) {
    const step = err.step ?? 'unknown';
    console.error(`[daily-predictions] FAILED ${label} at step="${step}": ${err.message}`);
    console.error(err.stack ?? '(no stack)');
    return Response.json({ error: err.message, step, gamePk: target.gamePk }, { status: 500 });
  }
}
