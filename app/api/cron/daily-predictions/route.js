import { predictGame } from '@/lib/predict-game';
import { savePrediction, predictionExistsForGame } from '@/lib/db';

const MLB_BASE = 'https://statsapi.mlb.com/api/v1';

// Vercel Pro/Enterprise allows up to 300s; set max so the cron doesn't get
// cut off mid-game while running predictions sequentially.
export const maxDuration = 300;

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];

  // 1. Fetch today's MLB schedule
  let games;
  try {
    const res = await fetch(
      `${MLB_BASE}/schedule?sportId=1&date=${today}&gameType=R`
    );
    const data = await res.json();
    games = (data?.dates?.[0]?.games ?? []).map((g) => ({
      gamePk: g.gamePk,
      gameDate: today,
      homeTeamId: g.teams?.home?.team?.id,
      homeTeamName: g.teams?.home?.team?.name,
      awayTeamId: g.teams?.away?.team?.id,
      awayTeamName: g.teams?.away?.team?.name,
    })).filter((g) => g.homeTeamId && g.awayTeamId);
  } catch (err) {
    console.error('Failed to fetch today\'s schedule:', err);
    return Response.json({ error: 'Failed to fetch MLB schedule' }, { status: 500 });
  }

  if (!games.length) {
    return Response.json({ message: 'No games scheduled today', predicted: 0, skipped: 0 });
  }

  // 2. Process each game sequentially to respect Anthropic rate limits
  let predicted = 0;
  let skipped = 0;
  const errors = [];

  for (const game of games) {
    // Skip if we already have a prediction for this game
    try {
      const exists = await predictionExistsForGame(game.gamePk);
      if (exists) {
        skipped++;
        continue;
      }
    } catch (err) {
      console.error(`DB check failed for game ${game.gamePk}:`, err);
      errors.push({ gamePk: game.gamePk, error: err?.message });
      continue;
    }

    // Run the full 4-stage prediction (send is a no-op — no streaming needed)
    try {
      const { verdict } = await predictGame({
        team1Id: game.homeTeamId,
        team1Name: game.homeTeamName,
        team2Id: game.awayTeamId,
        team2Name: game.awayTeamName,
      });

      if (!verdict) {
        errors.push({ gamePk: game.gamePk, error: 'Verdict parse failed' });
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
      console.log(`Predicted ${game.homeTeamName} vs ${game.awayTeamName}: ${verdict.winner} wins (${verdict.confidence}%)`);
    } catch (err) {
      console.error(`Prediction failed for game ${game.gamePk}:`, err);
      errors.push({ gamePk: game.gamePk, error: err?.message });
    }
  }

  return Response.json({
    date: today,
    totalGames: games.length,
    predicted,
    skipped,
    errors: errors.length ? errors : undefined,
  });
}
