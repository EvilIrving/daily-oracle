import { json } from '@sveltejs/kit';
import { getStoredConfig, saveStoredConfig } from '$lib/server/config';

export async function GET() {
  return json({ config: getStoredConfig() });
}

export async function POST({ request }) {
  const payload = await request.json();
  const config = saveStoredConfig(payload);
  return json({ config });
}
