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

  const errors = [];
  page.on('pageerror', err => {
    errors.push(String((err && err.message) || err));
  });
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.includes('Failed to load resource')) return;
    if (text.includes('favicon')) return;
    errors.push(text);
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });

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

  await page.evaluate(() => {
    const grokTab = document.querySelector('[data-trigger="tab.grok"]');
    if (!grokTab) throw new Error('grok tab trigger not found');
    grokTab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await page.waitForFunction(() => window.__OS__?.getAppRoute()?.path === '/grok');
  await sleep(400);

  const actions = [
    'grok.mode.open',
    'grok.history.open',
    'grok.chat.new',
    'grok.quick.createImage',
    'grok.quick.editImage',
    'grok.quick.voiceMode',
    'grok.file.attach',
    'grok.app.download',
  ];

  for (const id of actions) {
    await page.evaluate(actionId => {
      const el = document.querySelector(`[data-action="${actionId}"]`);
      if (!el) throw new Error(`action element not found: ${actionId}`);
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }, id);
    await sleep(100);
  }

  await page.type('textarea[placeholder]', 'hello');
  await sleep(100);

  await page.evaluate(() => {
    const el = document.querySelector('[data-action="grok.message.send"]');
    if (!el) throw new Error('send action not found');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });

  await sleep(300);

  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  const route = await page.evaluate(() => window.__OS__?.getAppRoute());
  console.log(JSON.stringify({ ok: true, route }));
} finally {
  await browser.close();
}
