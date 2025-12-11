const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--window-size=1200,800']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    // Open the local HTML file
    const filePath = path.join(__dirname, 'index.html');
    await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });

    // Take screenshot
    await page.screenshot({ path: path.join(__dirname, 'screenshot.png') });

    await browser.close();
    console.log("Screenshot generated at: screenshot.png");
})();
