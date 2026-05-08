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
  await page.evaluate(() => window.__OS__?.openApp('x', '/?tab=foryou'));
  await page.waitForFunction(() => window.__OS__?.getAppRoute()?.path === '/?tab=foryou');

  await page.waitForSelector('[data-trigger="reply.open"]');

  const targetId = await page.evaluate(() => {
    const el = document.querySelector('[data-trigger="reply.open"]');
    if (!el) return null;
    const raw = el.getAttribute('data-trigger-params');
    if (!raw) return null;
    try {
      const json = JSON.parse(raw);
      return json?.id || null;
    } catch {
      return null;
    }
  });

  await page.click('[data-trigger="reply.open"]');
  await page.waitForFunction(() => window.__OS__?.getAppRoute()?.path?.startsWith('/reply/'));

  await page.waitForSelector('textarea[placeholder="发布你的回复"]');
  await page.type('textarea[placeholder="发布你的回复"]', '测试回复');

  await page.waitForSelector('[data-action="reply.post.submit"]');
  await page.click('[data-action="reply.post.submit"]');
  await page.waitForFunction(() => window.__OS__?.getAppRoute()?.path === '/?tab=foryou');

  console.log(JSON.stringify({ ok: true, targetId }));
} finally {
  await browser.close();
}

