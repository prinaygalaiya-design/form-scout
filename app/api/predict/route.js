import { predictGame } from '@/lib/predict-game';
import { savePrediction } from '@/lib/db';

export async function POST(request) {
  const { team1Id, team1Name, team2Id, team2Name } = await request.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
      };

      try {
        const { verdict, nextGame } = await predictGame({
          team1Id, team1Name, team2Id, team2Name, send,
        });

        if (verdict) {
          const predId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          try {
            await savePrediction({
              id: predId,
              team1: team1Name,
              team2: team2Name,
              team1Id,
              team2Id,
              predictedWinner: verdict.winner,
              confidence: verdict.confidence,
              predictedScore: verdict.predictedScore,
              gameDate: nextGame?.date ?? null,
              gameId: nextGame?.gamePk ?? null,
            });
            send({ type: 'done', predictionId: predId });
          } catch (dbErr) {
            console.error('DB save failed:', dbErr);
            send({ type: 'done' });
          }
        } else {
          send({ type: 'done' });
        }
      } catch (err) {
        send({ type: 'error', message: err?.message ?? 'Unknown error' });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}
