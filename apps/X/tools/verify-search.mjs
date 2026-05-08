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

    await page.evaluate(() => window.__OS__?.openApp('x', '/search?tab=foryou'));
    await page.waitForFunction(() => window.__OS__?.getAppRoute()?.path === '/search?tab=foryou');

    await page.click('[data-trigger="search.input.open"]');
    await page.waitForFunction(() => window.__OS__?.getAppRoute()?.path === '/search/input');

    await page.type('input[placeholder="搜索"]', 'dotey');
    await page.waitForFunction(() => ((document.body && document.body.innerText) || '').includes('@dotey'));

    const clicked = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('[data-trigger="user.open.fromSearch"]'));
        const row = rows.find(d => (d.textContent || '').includes('@dotey'));
        if (!row) return false;
        row.click();
        return true;
    });

    await page.waitForFunction(() => window.__OS__?.getAppRoute()?.path === '/user/u_dotey');

    await page.evaluate(() => window.__OS__?.handleBack());
    await page.waitForFunction(() => window.__OS__?.getAppRoute()?.path === '/search/input');

    await page.click('input[placeholder="搜索"]', { clickCount: 3 });
    await page.type('input[placeholder="搜索"]', 'zzzz_not_exist');
    await page.waitForFunction(() => ((document.body && document.body.innerText) || '').includes('没有找到相关用户'));

    const route = await page.evaluate(() => window.__OS__?.getAppRoute());
    console.log(JSON.stringify({ ok: true, clicked, route }));
} finally {
    await browser.close();
}