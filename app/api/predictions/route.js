import { ensureTable, fetchAllPredictions } from '@/lib/db';

export async function GET() {
  try {
    await ensureTable();
    const rows = await fetchAllPredictions();
    const predictions = rows.map((r) => ({
      id: r.id,
      date: r.created_at,
      team1Id: r.team1_id,
      team2Id: r.team2_id,
      team1Name: r.team1,
      team2Name: r.team2,
      predictedWinner: r.predicted_winner,
      predictedScore: r.predicted_score,
      confidence: r.confidence,
      gameId: r.game_id,
      gameDate: r.game_date,
      actualWinner: r.actual_winner ?? undefined,
      actualScore: r.actual_score ?? undefined,
      correct: r.correct ?? undefined,
      checked: r.correct !== null && r.correct !== undefined,
    }));
    return Response.json({ predictions });
  } catch (err) {
    console.error('Failed to fetch predictions:', err);
    return Response.json({ predictions: [], error: 'Database unavailable' }, { status: 500 });
  }
}
