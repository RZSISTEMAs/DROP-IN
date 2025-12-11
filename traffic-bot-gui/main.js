const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const puppeteer = require('puppeteer');
const os = require('os');

let mainWindow;

// CONFIG
const MIN_FREE_RAM_MB = 800;
const EST_RAM_PER_TAB_MB = 250;

// STATE
let isRunning = false;
let isStopping = false;
let activeBrowsers = [];
let stats = {
    targetViews: 0,
    currentActive: 0,
    launchedCount: 0,
    url: ''
};

// ASSETS
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0'
];

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        autoHideMenuBar: true,
        backgroundColor: '#0a0a12', // Matches CSS
        title: 'DROP-IN v4.0 (Dashboard PRO)',
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });


// --- IPC ---

ipcMain.on('run-benchmark', () => {
    log('>>> Iniciando Análise de Hardware (RZ-Benchmark)...', true);
    const freeMem = Math.round(os.freemem() / 1024 / 1024);
    log(`Memória Livre Detectada: ${freeMem} MB`);

    const limit = Math.max(1, Math.floor((freeMem - MIN_FREE_RAM_MB) / EST_RAM_PER_TAB_MB));
    log(`Capacidade Segura Estimada: ${limit} janelas.`);
    mainWindow.webContents.send('benchmark-result', limit);
});

ipcMain.on('start-bot', (event, data) => {
    if (isRunning) return;
    stats.url = data.url.startsWith('http') ? data.url : `https://${data.url}`;
    stats.targetViews = parseInt(data.targetViews, 10);

    stats.currentActive = 0;
    stats.launchedCount = 0;
    isRunning = true;
    isStopping = false;
    activeBrowsers = [];

    updateUI('status', 'ATIVO - OPERANDO');
    updateUI('active', 0);
    log('=========================================', true);
    log('SISTEMA DROP-IN v4.0 INICIADO');
    log(`Alvo: ${stats.url}`);
    log(`Meta: ${stats.targetViews} janelas simultâneas`);
    log('=========================================', true);

    processLoop();
});

ipcMain.on('stop-bot', async () => {
    log('>>> COMANDO DE PARADA RECEBIDO.', true);
    isStopping = true;
    isRunning = false;
    updateUI('status', 'ENCERRANDO...');

    await Promise.all(activeBrowsers.map(b => b.close().catch(() => { })));
    activeBrowsers = [];
    stats.currentActive = 0;
    updateUI('active', 0);
    updateUI('status', 'PARADO');
    mainWindow.webContents.send('bot-stopped');
    log('Todas as instâncias foram encerradas.');
});

async function processLoop() {
    while (stats.currentActive < stats.targetViews) {
        if (!isRunning || isStopping) break;

        const freeMem = Math.round(os.freemem() / 1024 / 1024);
        if (freeMem < MIN_FREE_RAM_MB) {
            log(`[PROTEÇÃO] Memória Crítica (${freeMem}MB). Pausando novas janelas...`, true);
            updateUI('status', 'PAUSADO (RAM)');
            await new Promise(r => setTimeout(r, 5000));
            continue;
        } else {
            updateUI('status', 'ATIVO - OPERANDO');
        }

        launchBrowser();
        await new Promise(r => setTimeout(r, 1500));
    }
}

async function launchBrowser() {
    stats.currentActive++;
    stats.launchedCount++;
    const id = stats.launchedCount;
    updateUI('active', stats.currentActive);

    try {
        log(`[Instância #${id}] Inicializando...`);
        const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        const fakeIP = Array(4).fill(0).map(() => Math.floor(Math.random() * 255)).join('.');

        const browser = await puppeteer.launch({
            headless: false,
            args: [
                '--window-size=350,500',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                `--window-position=${(id * 30) % 1000},${(id * 30) % 600}`,
                `--user-agent=${ua}`
            ],
            defaultViewport: null
        });

        activeBrowsers.push(browser);
        const pages = await browser.pages();
        const page = pages.length > 0 ? pages[0] : await browser.newPage();

        await page.setExtraHTTPHeaders({ 'X-Forwarded-For': fakeIP, 'X-Real-IP': fakeIP });

        await page.goto(stats.url, { waitUntil: 'domcontentloaded', timeout: 50000 }).catch(() => { });

        // --- INJETAR VISUALIZADOR DE IP (VISUAL IP) ---
        await page.evaluate((ip) => {
            const div = document.createElement('div');
            div.style.position = 'fixed';
            div.style.bottom = '10px';
            div.style.right = '10px';
            div.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
            div.style.color = 'white';
            div.style.padding = '8px 12px';
            div.style.fontFamily = 'monospace';
            div.style.fontSize = '12px';
            div.style.fontWeight = 'bold';
            div.style.zIndex = '999999';
            div.style.pointerEvents = 'none';
            div.style.borderRadius = '4px';
            div.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
            div.innerHTML = `IP PROTEGIDO<br>${ip}`;
            document.body.appendChild(div);
        }, fakeIP);

        log(`[Instância #${id}] Conectada. IP Spoof: ${fakeIP}`);
        runActions(page, browser);

    } catch (e) {
        log(`[Erro #${id}] ${e.message}`, true);
        stats.currentActive--;
        updateUI('active', stats.currentActive);
    }
}

async function runActions(page, browser) {
    while (isRunning && !isStopping) {
        if (page.isClosed()) break;
        try {
            await new Promise(r => setTimeout(r, Math.random() * 5000 + 3000));
            if (isStopping) break;

            const rnd = Math.random();
            if (rnd < 0.5) await page.evaluate(() => window.scrollBy(0, 50));
            else await page.mouse.move(100, 100);

        } catch (e) { break; }
    }
    if (!isStopping) {
        const i = activeBrowsers.indexOf(browser);
        if (i > -1) activeBrowsers.splice(i, 1);
        stats.currentActive--;
        updateUI('active', stats.currentActive);
        log('Instância fechada manualmente.');
    }
}

function updateUI(type, value) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-stats', { type, value });
}
function log(msg, highlight = false) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        const time = new Date().toLocaleTimeString('pt-BR');
        mainWindow.webContents.send('log', { msg: `[${time}] ${msg}`, highlight });
    }
}
