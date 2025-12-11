const puppeteer = require('puppeteer');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

// Global array to track browsers for cleanup
const activeBrowsers = [];

(async () => {
    try {
        console.log("=== Interactive Traffic Bot ===");

        let targetUrl = await askQuestion("Enter the URL to open: ");
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
        }

        const totalTabsStr = await askQuestion("Enter total number of tabs to open: ");
        const totalTabs = parseInt(totalTabsStr, 10);

        if (isNaN(totalTabs) || totalTabs <= 0) {
            console.error("Invalid number of tabs.");
            process.exit(1);
        }

        console.log(`\nStarting ${totalTabs} tabs for ${targetUrl}...`);
        console.log("Type 'exit' or Press Ctrl+C at any time to close all windows.\n");

        const TABS_PER_BROWSER = 6;
        const NUM_BROWSERS = Math.ceil(totalTabs / TABS_PER_BROWSER);

        // Listen for exit command without blocking
        rl.on('line', (input) => {
            if (input.trim().toLowerCase() === 'exit') {
                console.log("Closing all browsers...");
                closeAll();
            }
        });

        for (let b = 0; b < NUM_BROWSERS; b++) {
            // Check if we should stop (in case user exited mid-launch)
            if (activeBrowsers.isClosing) break;

            console.log(`[System] Launching Browser Instance ${b + 1}/${NUM_BROWSERS}...`);

            const browser = await puppeteer.launch({
                headless: false,
                args: [
                    '--window-size=300,400', // Small window size
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    // Position windows slightly offset so they don't completely stack perfectly (optional polish)
                    `--window-position=${(b * 50) % 800},${(b * 50) % 600}`
                ],
                defaultViewport: null
            });

            activeBrowsers.push(browser);

            const tabsThisBatch = Math.min(TABS_PER_BROWSER, totalTabs - (b * TABS_PER_BROWSER));

            for (let i = 0; i < tabsThisBatch; i++) {
                if (activeBrowsers.isClosing) break;

                const globalTabIndex = (b * TABS_PER_BROWSER) + i + 1;

                try {
                    const page = await browser.newPage();

                    // Navigate
                    page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => { });

                    console.log(`[Opened] Tab ${globalTabIndex} in Browser ${b + 1}`);

                    // Start Anti-Bot Auto Clicker / Human Simulation
                    startHumanSimulation(page, globalTabIndex);

                } catch (err) {
                    console.error(`Error opening tab ${globalTabIndex}:`, err.message);
                }

                // Small delay to prevent CPU spikes
                await new Promise(r => setTimeout(r, 1000));
            }

            // Small delay between browsers
            await new Promise(r => setTimeout(r, 2000));
        }

        console.log("\nAll requested tabs have been launched.");
        console.log("Bot is running. Type 'exit' to close everything.");

    } catch (error) {
        console.error("Fatal Error:", error);
        closeAll();
    }
})();

async function startHumanSimulation(page, tabId) {
    // Run an interval inside the page context or via Puppeteer API

    // Using Puppeteer API loop for better control from Node side
    // We run this "forever" until page closes
    while (!page.isClosed() && !activeBrowsers.isClosing) {
        try {
            // 1. Random Delay (5s to 15s)
            const randomDelay = Math.floor(Math.random() * 10000) + 5000;
            await new Promise(r => setTimeout(r, randomDelay));

            if (page.isClosed()) break;

            // 2. Random Action
            const action = Math.random();

            if (action < 0.4) {
                // Scroll
                await page.evaluate(() => {
                    window.scrollBy(0, (Math.random() < 0.5 ? 100 : -100));
                });
            } else if (action < 0.7) {
                // Move Mouse
                await page.mouse.move(
                    Math.random() * 300,
                    Math.random() * 400
                );
            } else {
                // Click a random element (safe elements mostly)
                await page.evaluate(() => {
                    const clickables = document.querySelectorAll('a, button, div, p, span');
                    if (clickables.length > 0) {
                        const randomEl = clickables[Math.floor(Math.random() * clickables.length)];
                        randomEl.click();
                    } else {
                        document.body.click();
                    }
                });
                // console.log(`[Tab ${tabId}] Auto-clicked.`); 
            }

        } catch (e) {
            // Page likely closed
            break;
        }
    }
}

async function closeAll() {
    activeBrowsers.isClosing = true;
    console.log("Shutting down...");
    for (const browser of activeBrowsers) {
        try {
            await browser.close();
        } catch (e) { }
    }
    process.exit(0);
}
