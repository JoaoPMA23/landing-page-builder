export async function GET() {
  return new Response(JSON.stringify({ ok: true, clientTs: new Date().toISOString() }), { headers: { 'Content-Type': 'application/json' } });
}
