// api/admin-login.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { passcode } = req.body || {};

  if (!passcode || passcode !== process.env.ADMIN_PASSCODE) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.status(200).json({
    token: process.env.ADMIN_TOKEN
  });
}