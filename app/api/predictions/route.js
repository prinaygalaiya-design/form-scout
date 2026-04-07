import { fetchAllPredictions } from '@/lib/db';

export async function GET() {
  try {
    const rows = await fetchAllPredictions();
    const predictions = rows.map((r) => ({
      id: r.id,
      date: r.createdAt,
      team1Id: r.team1Id,
      team2Id: r.team2Id,
      team1Name: r.team1,
      team2Name: r.team2,
      predictedWinner: r.predictedWinner,
      predictedScore: r.predictedScore,
      confidence: r.confidence,
      gameId: r.gameId,
      gameDate: r.gameDate,
      actualWinner: r.actualWinner ?? undefined,
      actualScore: r.actualScore ?? undefined,
      correct: r.correct ?? undefined,
      checked: r.correct !== null && r.correct !== undefined,
    }));
    return Response.json({ predictions });
  } catch (err) {
    console.error('Failed to fetch predictions:', err);
    return Response.json({ predictions: [], error: 'Database unavailable' }, { status: 500 });
  }
}
