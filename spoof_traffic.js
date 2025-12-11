const puppeteer = require('puppeteer');

// Function to generate a random IP address
function getRandomIP() {
    return Array(4).fill(0).map((_, i) => Math.floor(Math.random() * 255) + (i === 0 ? 1 : 0)).join('.');
}

(async () => {
    // Configuration
    const TOTAL_TABS = 30; // Total tabs requested
    const TABS_PER_BROWSER = 6; // Limit per browser to bypass audio constraints
    const NUM_BROWSERS = Math.ceil(TOTAL_TABS / TABS_PER_BROWSER);
    const targetUrl = 'https://habbisound.com.br/';

    // Store all page objects from all browsers here
    const pages = [];

    console.log(`Starting ${TOTAL_TABS} tabs across ${NUM_BROWSERS} browser instances (max ${TABS_PER_BROWSER} per window)...`);

    // 1. OPEN BROWSERS AND TABS
    for (let b = 0; b < NUM_BROWSERS; b++) {
        console.log(`\n[System] Launching Browser Instance ${b + 1}/${NUM_BROWSERS}...`);

        const browser = await puppeteer.launch({
            headless: false,
            args: [
                '--window-size=1280,720',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--autoplay-policy=no-user-gesture-required',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding'
            ]
        });

        // Determine how many tabs for this specific browser
        const tabsThisBatch = Math.min(TABS_PER_BROWSER, TOTAL_TABS - (b * TABS_PER_BROWSER));

        for (let i = 0; i < tabsThisBatch; i++) {
            const globalTabIndex = (b * TABS_PER_BROWSER) + i + 1;
            const fakeIP = getRandomIP();

            try {
                const page = await browser.newPage();
                page.fakeIP = fakeIP;
                page.browserId = b + 1; // Track which browser this page belongs to
                pages.push(page);

                await page.setRequestInterception(true);
                page.on('request', request => {
                    const headers = Object.assign({}, request.headers(), {
                        'X-Forwarded-For': page.fakeIP,
                        'X-Real-IP': page.fakeIP,
                        'Client-IP': page.fakeIP
                    });
                    request.continue({ headers });
                });

                console.log(`[Init] Browser ${b + 1} - Opening Tab ${i + 1}/${tabsThisBatch} (Total ${globalTabIndex}) - IP: ${fakeIP}`);

                page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => { });

                // Init Visuals
                page.evaluate((ip, bId) => {
                    const interval = setInterval(() => {
                        if (document.body) {
                            const div = document.createElement('div');
                            div.id = 'spoof-ip-box';
                            div.style.position = 'fixed';
                            div.style.top = '10px';
                            div.style.right = '10px';
                            div.style.padding = '10px 20px';
                            div.style.backgroundColor = '#ff0000';
                            div.style.color = '#fff';
                            div.style.zIndex = '999999';
                            div.style.borderRadius = '5px';
                            div.style.fontWeight = 'bold';
                            div.style.fontSize = '16px';
                            div.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
                            div.innerText = `IP: ${ip} (Browser ${bId})`;
                            document.body.appendChild(div);
                            clearInterval(interval);
                        }
                    }, 500);
                }, fakeIP, b + 1).catch(e => { });

            } catch (error) {
                console.error(`Error creating Tab ${globalTabIndex}:`, error.message);
            }
            // Small delay between tabs
            await new Promise(r => setTimeout(r, 1000));
        }

        // Small delay between browsers launching to avoid system choke
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log('\nAll tabs initialized. Starting Active Rotation & Reload Loop...');

    // 2. ROTATION LOOP
    while (true) {
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            try {
                // Check if page/browser is still open
                if (page.isClosed()) continue;

                // Bring to front (This brings it to front of ITS OWN browser window)
                try {
                    await page.bringToFront();
                } catch (e) {
                    // Browser might be closed or detached
                    continue;
                }

                const currentIP = page.fakeIP;
                console.log(`[Active] Browser ${page.browserId} - Tab ${i + 1} (IP: ${currentIP}). Reloading and Playing...`);

                // RELOAD THE PAGE
                try {
                    await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
                } catch (e) {
                    console.log(`Tab ${i + 1} reload timeout, continuing...`);
                }

                // ENSURE MUSIC IS PLAYING & RE-INJECT VISUALS
                await page.evaluate((ip, bId) => {
                    // 1. Re-inject Box
                    if (!document.getElementById('spoof-ip-box')) {
                        const div = document.createElement('div');
                        div.id = 'spoof-ip-box';
                        div.style.position = 'fixed';
                        div.style.top = '10px';
                        div.style.right = '10px';
                        div.style.padding = '10px 20px';
                        div.style.backgroundColor = '#ff0000';
                        div.style.color = '#fff';
                        div.style.zIndex = '999999';
                        div.style.borderRadius = '5px';
                        div.style.fontWeight = 'bold';
                        div.style.fontSize = '16px';
                        div.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
                        div.innerText = `IP: ${ip} (Browser ${bId})`;
                        document.body.appendChild(div);
                    }

                    // 2. TARGETED PLAY CLICK - User Provided Selector
                    const playBtn = document.getElementById('play-pause-btn');
                    if (playBtn) {
                        playBtn.click();
                        console.log("Clicked #play-pause-btn");
                    } else {
                        // Fallback
                        document.querySelectorAll('audio').forEach(a => {
                            a.muted = false;
                            a.play().catch(e => { });
                        });
                        document.querySelectorAll('.play, .fa-play').forEach(b => b.click());
                    }

                    document.body.click();

                }, currentIP, page.browserId).catch(e => { });

                // Stay on this tab for 5 seconds as requested
                await new Promise(r => setTimeout(r, 5000));
            } catch (e) {
                console.log(`Tab ${i + 1} error: ${e.message}`);
            }
        }
        // Loop restart
    }
})();
