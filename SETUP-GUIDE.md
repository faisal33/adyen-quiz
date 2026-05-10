# Adyen World Cup Quiz — Setup Guide

A secure deployment with the Airtable token kept server-side. ~20 minutes end to end.

## What you have

```
adyen-quiz/
  index.html                       ← the quiz frontend
  api/submit.js                    ← Vercel function
  netlify/functions/submit.js      ← Netlify function (alternative)
  netlify.toml                     ← maps /api/submit → Netlify function
  vercel.json                      ← Vercel config
```

The frontend POSTs to `/api/submit`. That endpoint lives on the same domain (Vercel or Netlify), holds the Airtable token in environment variables, validates the payload, and forwards to Airtable. The token is never exposed to the iPad.

---

## 1. Set up Airtable (5 min)

1. Go to **airtable.com** → **Create a base** → name it `Adyen Canada Quiz`.
2. Rename the default table to `Submissions`.
3. Set the fields exactly as below (case-sensitive):

   | Field name | Type |
   |---|---|
   | Name | Single line text |
   | Email | Email |
   | Score | Number (integer) |
   | Tier | Single line text |
   | Submitted | Date — **enable "include time"** |
   | Answers | Long text |

4. Get the **Base ID** (starts with `app...`):
   - Click your profile → **Builder hub** → **API documentation** for this base
   - Copy the ID near the top.

5. Create a **Personal Access Token**:
   - Go to **airtable.com/create/tokens** → **Create new token**
   - Name: `Adyen Quiz Server`
   - Scope: check **`data.records:write`** *(write only — no read needed)*
   - Access: select **only the `Adyen Canada Quiz` base**
   - Click **Create token** and copy it (starts with `pat...`). You won't see it again.

---

## 2. Deploy — pick one

### Option A: Vercel (recommended)

1. Sign in at **vercel.com** with GitHub or email.
2. Easiest path — drag-and-drop deploy:
   - Run once locally: install the CLI with `npm i -g vercel`, then in the project folder run `vercel`. Follow prompts (link to your account, accept defaults). Or use the Vercel dashboard's "Import" → upload zip.
   - Or push the folder to a GitHub repo and click **Add New → Project** in Vercel.
3. After the first deploy, go to **Project Settings → Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `AIRTABLE_BASE_ID` | your `app...` id |
   | `AIRTABLE_TABLE_NAME` | `Submissions` |
   | `AIRTABLE_TOKEN` | your `pat...` token |
   | `KIOSK_KEY` | a random string of your choice (optional, see below) |

4. **Redeploy** so the env vars take effect (Deployments → ⋯ → Redeploy).
5. Your URL is `https://your-project.vercel.app`. Test by opening it on a laptop, taking the quiz, and checking Airtable.

### Option B: Netlify

1. Sign in at **app.netlify.com**.
2. Either drag the project folder into **Sites → Add new site → Deploy manually**, or connect a GitHub repo.
3. Go to **Site settings → Environment variables** and add the same four variables as above.
4. Trigger a redeploy.
5. Your URL is `https://your-site.netlify.app`. The `netlify.toml` redirect makes `/api/submit` route to the function automatically — no frontend changes needed.

---

## 3. Optional but recommended: kiosk key

Without a kiosk key, anyone who finds your URL could POST junk submissions. To prevent that:

1. Pick any random string, e.g. `adyen-canada-2026-x9k2`.
2. Set it as the `KIOSK_KEY` env var on Vercel/Netlify.
3. In `index.html`, find the `ENDPOINT` block near the top of the `<script>` and paste the same value:
   ```js
   const ENDPOINT = {
     url:      '/api/submit',
     kioskKey: 'adyen-canada-2026-x9k2'
   };
   ```
4. Redeploy.

The server now rejects any POST that doesn't include the matching `X-Kiosk-Key` header. The key is still visible in HTML source if someone digs, but combined with the URL, it's a meaningful barrier.

---

## 4. iPad setup (3 min)

1. Open the Vercel/Netlify URL in Safari on the iPad.
2. Tap **share** → **Add to Home Screen** → name it "Adyen Quiz".
3. Tap the new home-screen icon — full-screen kiosk mode, no Safari chrome.
4. **Settings → Display & Brightness → Auto-Lock → Never**.
5. **Settings → Accessibility → Guided Access → On** — triple-click the side button while the quiz is open to lock the iPad to that one app.

---

## 5. Test the full flow

1. On the iPad (or a laptop browser), take the quiz with a test submission.
2. Open Airtable — the row should appear within 1–2 seconds.
3. Tap the small Adyen logo at the top-left **5 times** to open the hidden admin panel — entries show **✓ synced** when the server confirmed, **⏱ pending** if queued.
4. Click **Export CSV** to confirm export works.
5. Try airplane mode → take the quiz → reconnect → entry should auto-flush within 30 sec.

---

## During the event

- Submissions land in Airtable in real time
- WiFi drops are handled — entries queue locally on the iPad and auto-retry on reconnect, focus, and every 30 seconds
- Hidden admin (5 logo taps) shows live sync status

## After the event — picking the raffle winner

In Airtable:
- Open the `Submissions` table; filter if needed (e.g. only `Score >= 4`)
- Add a temporary formula field `RAND()` → sort by it → row 1 is your winner
- Or use Airtable Automations → "Pick random record"

**Then revoke the Airtable token** at airtable.com/create/tokens. Even though it's only on your server, no reason to leave it active once the event is over.

---

## Troubleshooting

**Entries not reaching Airtable**
- Open the admin panel (5 taps on logo). Are there ⏱ pending entries?
  - Yes → server is rejecting them. Check Vercel/Netlify function logs (Vercel: Project → Deployments → Functions; Netlify: Site → Functions → submit → recent invocations). The exact error will be there. Most common: env vars not set, or Airtable field name typo.
- Open the URL in a laptop browser, hit DevTools → Network → take the quiz. The `/api/submit` request will show the response — usually the error message is in the body.

**`401 Unauthorized`**
- Kiosk key mismatch. Either remove the key from both server and frontend, or make sure they match exactly.

**`502 Airtable rejected the record`**
- Field name in Airtable doesn't match exactly (`Submitted` not `submitted`, etc.)
- Check the function logs for Airtable's full error message.

**`500 Server not configured`**
- `AIRTABLE_BASE_ID` or `AIRTABLE_TOKEN` env var isn't set, or you didn't redeploy after adding them.

**iPad shows "endpoint not configured" in admin**
- The `ENDPOINT.url` in `index.html` is empty. Should be `'/api/submit'`.
