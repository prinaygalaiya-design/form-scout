export async function GET() {
  const key = process.env.CRICAPI_KEY;
  const response = await fetch(
    `https://api.cricapi.com/v1/currentMatches?apikey=${key}&offset=0`
  );

  const text = await response.text();
  console.log('CricAPI currentMatches raw response:', text.slice(0, 500));

  try {
    const data = JSON.parse(text);

    // Filter to IPL matches only
    const IPL_SERIES_ID = 'a7df6d61-e0d1-4335-8879-01648bbb497f';
    const iplMatches = (data?.data ?? []).filter(
      (m) =>
        m?.series_id === IPL_SERIES_ID ||
        (m?.name ?? '').toLowerCase().includes('ipl') ||
        (m?.name ?? '').toLowerCase().includes('indian premier league')
    );

    return Response.json({ ...data, data: iplMatches });
  } catch {
    return new Response(text, {
      status: response.status,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
