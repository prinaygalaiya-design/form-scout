import { createClient } from '@vercel/postgres';

export async function GET() {
  const client = createClient();
  try {
    await client.connect();
    const { rows } = await client.sql`SELECT 1 AS ok`;
    return Response.json({ ok: true, rows });
  } catch (err) {
    return Response.json({
      ok: false,
      error: err.message,
      stack: err.stack ?? null,
    }, { status: 500 });
  } finally {
    await client.end().catch(() => {});
  }
}
