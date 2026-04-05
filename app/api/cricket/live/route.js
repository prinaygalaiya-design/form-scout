export async function GET() {
  const response = await fetch(
    'https://free-cricbuzz-cricket-api.p.rapidapi.com/cricket-livescores',
    {
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
        'x-rapidapi-host': 'free-cricbuzz-cricket-api.p.rapidapi.com',
      },
    }
  );

  const text = await response.text();
  console.log('Live scores raw response:', text);

  try {
    const data = JSON.parse(text);
    return Response.json(data);
  } catch {
    return new Response(text, {
      status: response.status,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
