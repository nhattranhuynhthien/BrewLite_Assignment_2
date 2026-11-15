const apiBase = (
  process.env.SMOKE_API_URL || 'http://127.0.0.1:4000'
).replace(/\/+$/, '');
const webBase = process.env.SMOKE_WEB_URL
  ? process.env.SMOKE_WEB_URL.replace(/\/+$/, '')
  : '';

async function assertOkJson(url, validator) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Smoke check failed for ${url}: HTTP ${res.status}`);
  }
  const body = await res.json();
  if (validator && !validator(body)) {
    throw new Error(`Smoke payload invalid for ${url}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  await assertOkJson(`${apiBase}/health/live`, (b) => b.status === 'ok');
  await assertOkJson(
    `${apiBase}/health`,
    (b) => b.status === 'ok' && b.database === 'up',
  );
  await assertOkJson(`${apiBase}/products`, (b) => Array.isArray(b.items));

  if (webBase) {
    const webRes = await fetch(`${webBase}/`);
    if (!webRes.ok) {
      throw new Error(`Web smoke check failed for ${webBase}: HTTP ${webRes.status}`);
    }
  }

  console.log(
    JSON.stringify({
      event: 'smoke_test_passed',
      apiBase,
      webBase: webBase || null,
      timestamp: new Date().toISOString(),
    }),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
