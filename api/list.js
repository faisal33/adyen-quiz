if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) {
  return res.status(401).json({ error: 'Unauthorized' });
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Kiosk-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (process.env.KIOSK_KEY && req.headers['x-kiosk-key'] !== process.env.KIOSK_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || 'Submissions';
  const token = process.env.AIRTABLE_TOKEN;
  if (!baseId || !token) return res.status(500).json({ error: 'Server not configured' });
  try {
    const records = [];
    let offset;
    do {
      const u = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);
      u.searchParams.set('pageSize', '100');
      if (offset) u.searchParams.set('offset', offset);
      const r = await fetch(u, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        return res.status(502).json({ error: 'Airtable rejected', details: txt.slice(0, 200) });
      }
      const data = await r.json();
      for (const rec of data.records || []) {
        records.push({
          id: rec.id,
          name:      rec.fields.Name      || '',
          email:     rec.fields.Email     || '',
          score:     rec.fields.Score     ?? 0,
          tier:      rec.fields.Tier      || '',
          timestamp: rec.fields.Submitted || rec.createdTime
        });
      }
      offset = data.offset;
    } while (offset);
    return res.status(200).json({ records });
  } catch(e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}