export async function GET(request) {
  const matchId = request.nextUrl.searchParams.get('matchId');

  const response = await fetch(
    `https://free-cricbuzz-cricket-api.p.rapidapi.com/cricket-match-scoreboard?matchid=${matchId}`,
    {
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
        'x-rapidapi-host': 'free-cricbuzz-cricket-api.p.rapidapi.com',
      },
    }
  );

  const text = await response.text();
  console.log(`Scoreboard raw response (matchId=${matchId}):`, text.slice(0, 300));

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
