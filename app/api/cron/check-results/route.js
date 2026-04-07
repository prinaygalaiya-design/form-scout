import { fetchPendingPredictions, updatePredictionResult } from '@/lib/db';

const MLB_BASE = 'https://statsapi.mlb.com/api/v1';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const pending = await fetchPendingPredictions();

    let updated = 0;
    await Promise.all(
      pending.map(async (pred) => {
        try {
          const res = await fetch(
            `${MLB_BASE}/schedule?gamePk=${pred.gameId}&hydrate=linescore`
          );
          const data = await res.json();
          const game = data?.dates?.[0]?.games?.[0];
          if (!game || game.status?.abstractGameState !== 'Final') return;

          const home = game.teams?.home;
          const away = game.teams?.away;
          const isTeam1Home = home?.team?.id === pred.team1Id;
          const t1 = isTeam1Home ? home : away;
          const actualWinner = t1?.isWinner ? pred.team1 : pred.team2;
          const actualScore = `${home?.score ?? 0}-${away?.score ?? 0}`;
          const correct = actualWinner === pred.predictedWinner;

          await updatePredictionResult(pred.id, actualWinner, actualScore, correct);
          updated++;
        } catch (err) {
          console.error(`Failed to check game ${pred.gameId}:`, err);
        }
      })
    );

    return Response.json({ checked: pending.length, updated });
  } catch (err) {
    console.error('Cron check-results failed:', err);
    return Response.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
