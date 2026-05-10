// Netlify serverless function: POST /api/submit (via netlify.toml redirect)
// Set these env vars in Netlify site settings → Environment variables:
//   AIRTABLE_BASE_ID       (e.g. appXXXXXXXXXXXXXX)
//   AIRTABLE_TABLE_NAME    (default: "Submissions")
//   AIRTABLE_TOKEN         (Personal Access Token, scopes: data.records:write, this base only)
//   KIOSK_KEY              (optional shared secret — must match X-Kiosk-Key header from the iPad)

const headers = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Kiosk-Key',
  'Content-Type':                 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  if (process.env.KIOSK_KEY && (event.headers['x-kiosk-key'] || event.headers['X-Kiosk-Key']) !== process.env.KIOSK_KEY) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch(e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad JSON' }) }; }

  const { name, email, score, tier, timestamp, answers } = body;
  if (!isString(name, 1, 200))     return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid name' }) };
  if (!isEmail(email))             return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email' }) };
  if (!isNumber(score, 0, 5))      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid score' }) };
  if (tier && !isString(tier, 0, 50)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid tier' }) };

  const baseId    = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || 'Submissions';
  const token     = process.env.AIRTABLE_TOKEN;
  if (!baseId || !token) {
    console.error('Airtable env vars missing');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server not configured' }) };
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
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Airtable rejected the record' }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error('Submit failed', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};

function isString(v, min, max){ return typeof v === 'string' && v.length >= min && v.length <= max; }
function isEmail(v){ return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 320; }
function isNumber(v, min, max){ return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max; }
