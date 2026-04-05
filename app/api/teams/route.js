export async function GET() {
  const res = await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1');
  const data = await res.json();

  // Return only the fields the frontend needs, sorted alphabetically
  const teams = (data?.teams ?? [])
    .map((t) => ({ id: t.id, name: t.name, abbreviation: t.abbreviation }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return Response.json({ teams });
}
