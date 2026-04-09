import { predictGame } from '@/lib/predict-game';

// Hardcoded test: Yankees (147) vs Braves (144), gamePk 823884
// No auth — remove this route before going to production if desired.
export async function GET() {
  const team1Id   = 147;
  const team1Name = 'New York Yankees';
  const team2Id   = 144;
  const team2Name = 'Atlanta Braves';

  console.log(`[test-predict] Starting predictGame for ${team1Name} vs ${team2Name}`);

  try {
    const { verdict, nextGame } = await predictGame({ team1Id, team1Name, team2Id, team2Name });
    console.log('[test-predict] Success:', verdict?.winner);
    return Response.json({ ok: true, verdict, nextGame });
  } catch (err) {
    console.error('[test-predict] FAILED:', err.stack ?? err.message);
    return Response.json({
      ok: false,
      step: err.step ?? null,
      error: err.message,
      stack: err.stack ?? null,
    }, { status: 500 });
  }
}
