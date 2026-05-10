if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) {
  return res.status(401).json({ error: 'Unauthorized' });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Kiosk-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (process.env.KIOSK_KEY && req.headers['x-kiosk-key'] !== process.env.KIOSK_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || 'Submissions';
  const token = process.env.AIRTABLE_TOKEN;
  if (!baseId || !token) return res.status(500).json({ error: 'Server not configured' });
  try {
    const ids = [];
    let offset;
    do {
      const u = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);
      u.searchParams.set('pageSize', '100');
      u.searchParams.append('fields[]', 'Name');
      if (offset) u.searchParams.set('offset', offset);
      const r = await fetch(u, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!r.ok) return res.status(502).json({ error: 'Failed to list' });
      const data = await r.json();
      for (const rec of data.records || []) ids.push(rec.id);
      offset = data.offset;
    } while (offset);
    let deleted = 0;
    for (let i = 0; i < ids.length; i += 10) {
      const params = new URLSearchParams();
      ids.slice(i, i + 10).forEach(id => params.append('records[]', id));
      const r = await fetch(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?${params}`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!r.ok) return res.status(502).json({ error: 'Failed to delete batch', deleted });
      const data = await r.json();
      deleted += (data.records || []).length;
    }
    return res.status(200).json({ ok: true, deleted });
  } catch(e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}