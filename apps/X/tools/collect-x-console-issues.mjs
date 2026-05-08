import puppeteer from 'puppeteer';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 700 });
  page.setDefaultTimeout(45000);

  const consoleErrors = [];
  const consoleWarns = [];
  const consoleLogs = [];
  const requestFailures = [];
  const badResponses = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (!text) return;
    if (text.includes('favicon')) return;
    if (type === 'error') consoleErrors.push(text);
    if (type === 'warning' || type === 'warn') consoleWarns.push(text);
    if (type === 'log') consoleLogs.push(text);
  });

  page.on('requestfailed', req => {
    const url = req.url();
    if (!url) return;
    if (url.includes('favicon')) return;
    requestFailures.push({
      url,
      method: req.method(),
      resourceType: req.resourceType(),
      failure: req.failure()?.errorText,
    });
  });

  page.on('response', res => {
    const status = res.status();
    if (status < 400) return;
    const url = res.url();
    if (!url) return;
    if (url.includes('favicon')) return;
    const req = res.request();
    const resourceType = req.resourceType();
    badResponses.push({ status, url, resourceType });
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });

  const swipeLeft = async () => {
    await page.mouse.move(700, 350);
    await page.mouse.down();
    await page.mouse.move(150, 350, { steps: 12 });
    await page.mouse.up();
  };

  for (let i = 0; i < 3; i++) {
    const hasX = await page.evaluate(() =>
      Array.from(document.querySelectorAll('span')).some(s => (s.textContent || '').trim() === 'X'),
    );
    if (hasX) break;
    await swipeLeft();
    await sleep(350);
  }

  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('span')).find(s => (s.textContent || '').trim() === 'X');
    if (!el) throw new Error('X icon not found');
    el.click();
  });

  await page.waitForFunction(() => window.__OS__?.getAppRoute()?.app === 'x');
  await sleep(800);

  await page.evaluate(() => window.__OS__?.openApp('x', '/grok'));
  await page.waitForFunction(() => window.__OS__?.getAppRoute()?.path === '/grok');
  await sleep(800);

  await page.evaluate(() => window.__OS__?.openApp('x', '/?tab=foryou'));
  await page.waitForFunction(() => window.__OS__?.getAppRoute()?.path === '/?tab=foryou');
  await sleep(800);

  const summarize = (items, keyFn) => {
    const map = new Map();
    for (const it of items) {
      const key = keyFn(it);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count }));
  };

  console.log(
    JSON.stringify(
      {
        ok: true,
        consoleErrorCount: consoleErrors.length,
        consoleErrorsTop: summarize(consoleErrors, t => t).slice(0, 50),
        consoleWarnCount: consoleWarns.length,
        consoleWarnsTop: summarize(consoleWarns, t => t).slice(0, 50),
        consoleLogCount: consoleLogs.length,
        consoleLogsTop: summarize(consoleLogs, t => t).slice(0, 50),
        requestFailureCount: requestFailures.length,
        requestFailuresTop: summarize(
          requestFailures.map(r => `${r.resourceType} ${r.failure || ''} ${r.url}`),
          t => t,
        ).slice(0, 50),
        badResponseCount: badResponses.length,
        badResponsesTop: summarize(
          badResponses.map(r => `${r.status} ${r.resourceType} ${r.url}`),
          t => t,
        ).slice(0, 50),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
