import { predictGame } from '@/lib/predict-game';
import { ensureTable, savePrediction, predictionExistsForGame } from '@/lib/db';

const MLB_BASE = 'https://statsapi.mlb.com/api/v1';

export const maxDuration = 300;

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

  // 2. Process each game sequentially to respect Anthropic rate limits
  let predicted = 0;
  let skipped = 0;
  const errors = [];

  for (const game of games) {
    const label = `${game.homeTeamName} vs ${game.awayTeamName} (gamePk=${game.gamePk})`;

    // Skip if prediction already exists
    try {
      const exists = await predictionExistsForGame(game.gamePk);
      if (exists) {
        console.log(`[daily-predictions] Skipping ${label} — prediction already exists`);
        skipped++;
        continue;
      }
    } catch (err) {
      console.error(`[daily-predictions] DB check failed for ${label}:`, err.stack ?? err.message);
      errors.push({ gamePk: game.gamePk, step: 'db-exists-check', error: err.message });
      continue;
    }

    console.log(`[daily-predictions] Starting prediction for ${label}`);

    try {
      const { verdict } = await predictGame({
        team1Id: game.homeTeamId,
        team1Name: game.homeTeamName,
        team2Id: game.awayTeamId,
        team2Name: game.awayTeamName,
      });

      if (!verdict) {
        console.error(`[daily-predictions] Verdict parse failed for ${label}`);
        errors.push({ gamePk: game.gamePk, step: 'verdict-parse', error: 'Claude response was not valid JSON' });
        continue;
      }

      const predId = `cron-${game.gamePk}-${Date.now()}`;
      await savePrediction({
        id: predId,
        team1: game.homeTeamName,
        team2: game.awayTeamName,
        team1Id: game.homeTeamId,
        team2Id: game.awayTeamId,
        predictedWinner: verdict.winner,
        confidence: verdict.confidence,
        predictedScore: verdict.predictedScore,
        gameDate: game.gameDate,
        gameId: game.gamePk,
      });

      predicted++;
      console.log(`[daily-predictions] Done: ${label} → ${verdict.winner} wins (${verdict.confidence}%)`);
    } catch (err) {
      // err.step is set by predictGame's catch block — tells us exactly which
      // phase of data fetching or which Claude stage threw.
      const step = err.step ?? 'unknown';
      console.error(`[daily-predictions] FAILED ${label} at step="${step}": ${err.message}`);
      console.error(err.stack ?? '(no stack)');
      errors.push({ gamePk: game.gamePk, step, error: err.message });
    }
  }

  const summary = { date: today, totalGames: games.length, predicted, skipped, errors: errors.length ? errors : undefined };
  console.log('[daily-predictions] Complete:', JSON.stringify(summary));
  return Response.json(summary);
}
