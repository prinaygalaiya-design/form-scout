export async function GET() {
  const res = await fetch(
    `https://api.cricapi.com/v1/series_info?apikey=${process.env.CRICAPI_KEY}&id=87c62aac-bc3c-4738-ab93-19da0690488f`
  );
  const data = await res.json();
  return Response.json(data);
}
