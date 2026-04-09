import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

export async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS predictions (
      id               TEXT      PRIMARY KEY,
      team1            TEXT,
      team2            TEXT,
      team1_id         INTEGER,
      team2_id         INTEGER,
      predicted_winner TEXT,
      confidence       INTEGER,
      predicted_score  TEXT,
      actual_winner    TEXT,
      actual_score     TEXT,
      correct          BOOLEAN,
      game_date        TEXT,
      game_id          INTEGER,
      created_at       TIMESTAMP DEFAULT NOW()
    )
  `);
}

export async function savePrediction({ id, team1, team2, team1Id, team2Id, predictedWinner, confidence, predictedScore, gameDate, gameId }) {
  await pool.query(
    `INSERT INTO predictions
       (id, team1, team2, team1_id, team2_id, predicted_winner, confidence, predicted_score, game_date, game_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, team1, team2, team1Id, team2Id, predictedWinner, confidence, predictedScore, gameDate ?? null, gameId ?? null]
  );
}

export async function fetchAllPredictions() {
  const { rows } = await pool.query(`SELECT * FROM predictions ORDER BY created_at DESC`);
  return rows;
}

export async function fetchPendingPredictions() {
  const today = new Date().toISOString().split('T')[0];
  const { rows } = await pool.query(
    `SELECT * FROM predictions
     WHERE correct   IS NULL
       AND game_id   IS NOT NULL
       AND game_date IS NOT NULL
       AND game_date <= $1`,
    [today]
  );
  return rows;
}

export async function updatePredictionResult(id, actualWinner, actualScore, correct) {
  await pool.query(
    `UPDATE predictions
     SET actual_winner = $1,
         actual_score  = $2,
         correct       = $3
     WHERE id = $4`,
    [actualWinner, actualScore, correct, id]
  );
}

export async function predictionExistsForGame(gameId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM predictions WHERE game_id = $1 LIMIT 1`,
    [gameId]
  );
  return rows.length > 0;
}
