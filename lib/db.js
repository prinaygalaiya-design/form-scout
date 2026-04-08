import { sql } from '@vercel/postgres';

export async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS predictions (
      id               TEXT        PRIMARY KEY,
      team1            TEXT        NOT NULL,
      team2            TEXT        NOT NULL,
      team1_id         INTEGER     NOT NULL,
      team2_id         INTEGER     NOT NULL,
      predicted_winner TEXT        NOT NULL,
      confidence       INTEGER     NOT NULL,
      predicted_score  TEXT        NOT NULL,
      actual_winner    TEXT,
      actual_score     TEXT,
      correct          BOOLEAN,
      game_date        TEXT,
      game_id          INTEGER,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function savePrediction({ id, team1, team2, team1Id, team2Id, predictedWinner, confidence, predictedScore, gameDate, gameId }) {
  await sql`
    INSERT INTO predictions
      (id, team1, team2, team1_id, team2_id, predicted_winner, confidence, predicted_score, game_date, game_id)
    VALUES
      (${id}, ${team1}, ${team2}, ${team1Id}, ${team2Id}, ${predictedWinner}, ${confidence}, ${predictedScore}, ${gameDate}, ${gameId})
  `;
}

export async function fetchAllPredictions() {
  const { rows } = await sql`SELECT * FROM predictions ORDER BY created_at DESC`;
  return rows;
}

export async function fetchPendingPredictions() {
  const today = new Date().toISOString().split('T')[0];
  const { rows } = await sql`
    SELECT * FROM predictions
    WHERE correct    IS NULL
      AND game_id    IS NOT NULL
      AND game_date  IS NOT NULL
      AND game_date  <= ${today}
  `;
  return rows;
}

export async function updatePredictionResult(id, actualWinner, actualScore, correct) {
  await sql`
    UPDATE predictions
    SET actual_winner = ${actualWinner},
        actual_score  = ${actualScore},
        correct       = ${correct}
    WHERE id = ${id}
  `;
}

export async function predictionExistsForGame(gameId) {
  const { rows } = await sql`
    SELECT 1 FROM predictions WHERE game_id = ${gameId} LIMIT 1
  `;
  return rows.length > 0;
}
