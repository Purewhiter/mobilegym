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
        const msg = String((err && err.message) || err);
        if (msg.includes('Transition "') || msg.includes('Transition not found')) {
            errors.push(msg);
        }
    });
    page.on('console', msg => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        if (text.includes('Transition "') || text.includes('Transition not found')) {
            errors.push(text);
        }
    });

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });

    const swipeLeft = async() => {
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
    await page.evaluate(() => window.__OS__?.openApp('x', '/?tab=following'));
    await page.waitForFunction(() => window.__OS__?.getAppRoute()?.path === '/?tab=following');

    await page.evaluate(() => {
        const searchTab = document.querySelector('[data-trigger="tab.search"]');
        if (!searchTab) throw new Error('search tab trigger not found');
        const bar = searchTab.parentElement;
        const homeTab = bar && bar.firstElementChild;
        if (!homeTab) throw new Error('home tab not found');
        homeTab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    await sleep(600);

    const transitionErr = errors.find(e => e.includes('Transition "tab.home" not allowed'));
    if (transitionErr) {
        throw new Error(transitionErr);
    }
    if (errors.length > 0) {
        throw new Error(errors[0]);
    }

    const route = await page.evaluate(() => window.__OS__?.getAppRoute());
    console.log(JSON.stringify({ ok: true, route }));
} finally {
    await browser.close();
}