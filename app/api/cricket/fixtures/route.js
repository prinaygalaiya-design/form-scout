export async function GET(request) {
  const teamId = request.nextUrl.searchParams.get('teamId');

  const response = await fetch(
    `https://free-cricbuzz-cricket-api.p.rapidapi.com/cricket-schedule-league`,
    {
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
        'x-rapidapi-host': 'free-cricbuzz-cricket-api.p.rapidapi.com',
      },
    }
  );

  const text = await response.text();
  console.log(`Fixtures raw response (teamId=${teamId}):`, text);

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
