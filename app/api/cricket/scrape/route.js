export async function GET() {
  const res = await fetch('https://www.iplt20.com/matches/results', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FormScout/1.0)' },
  });

  const text = await res.text();
  console.log(`iplt20.com/matches/results — status: ${res.status}, length: ${text.length}`);

  return new Response(text, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
