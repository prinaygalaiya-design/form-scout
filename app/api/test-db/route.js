import pg from 'pg';
const { Pool } = pg;

export async function GET() {
  if (!process.env.POSTGRES_URL) {
    return Response.json({ ok: false, error: 'POSTGRES_URL env var is missing' }, { status: 500 });
  }

  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const { rows } = await pool.query('SELECT 1 AS ok');
    return Response.json({ ok: true, rows });
  } catch (err) {
    return Response.json({ ok: false, error: err.message, stack: err.stack ?? null }, { status: 500 });
  } finally {
    await pool.end();
  }
}
