// Vercel serverless function: POST /api/submit
// Set these env vars in Vercel project settings → Environment Variables:
//   AIRTABLE_BASE_ID       (e.g. appXXXXXXXXXXXXXX)
//   AIRTABLE_TABLE_NAME    (default: "Submissions")
//   AIRTABLE_TOKEN         (Personal Access Token, scopes: data.records:write, this base only)
//   KIOSK_KEY              (optional shared secret — must match X-Kiosk-Key header from the iPad)

export default async function handler(req, res) {
  // CORS — permissive because this endpoint only writes; never reads
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Kiosk-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Optional kiosk key check
  if (process.env.KIOSK_KEY && req.headers['x-kiosk-key'] !== process.env.KIOSK_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate payload
  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const { name, email, score, tier, timestamp, answers } = body;

  if (!isString(name, 1, 200))     return res.status(400).json({ error: 'Invalid name' });
  if (!isEmail(email))             return res.status(400).json({ error: 'Invalid email' });
  if (!isNumber(score, 0, 7))     return res.status(400).json({ error: 'Invalid score' });
  if (tier && !isString(tier, 0, 50)) return res.status(400).json({ error: 'Invalid tier' });

  // Forward to Airtable
  const baseId    = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || 'Submissions';
  const token     = process.env.AIRTABLE_TOKEN;
  if (!baseId || !token) {
    console.error('Airtable env vars missing');
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    const r = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify({
          fields: {
            Name:      name.trim(),
            Email:     email.trim().toLowerCase(),
            Score:     score,
            Tier:      tier || '',
            Submitted: timestamp || new Date().toISOString(),
            Answers:   Array.isArray(answers) ? answers.map(a => a ? 'Y' : 'N').join(' ') : ''
          },
          typecast: true
        })
      }
    );

    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.error('Airtable error', r.status, txt);
      return res.status(502).json({ error: 'Airtable rejected the record' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Submit failed', e);
    return res.status(500).json({ error: 'Server error' });
  }
}

function safeParse(s){ try { return JSON.parse(s); } catch(e){ return {}; } }
function isString(v, min, max){ return typeof v === 'string' && v.length >= min && v.length <= max; }
function isEmail(v){ return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 320; }
function isNumber(v, min, max){ return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max; }
