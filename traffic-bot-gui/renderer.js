const { ipcRenderer } = require('electron');

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const benchBtn = document.getElementById('benchBtn');
const infoBtn = document.getElementById('infoBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const infoModal = document.getElementById('infoModal');

const urlInput = document.getElementById('url');
const targetViewsInput = document.getElementById('targetViews');
const logContainer = document.getElementById('logs');
const activeEl = document.getElementById('activeCount');
const statusEl = document.getElementById('statusText');
const ramHint = document.getElementById('ram-hint');

// LOGIC
function log(msg, highlight) {
    const div = document.createElement('div');
    div.className = 'log-line';
    if (highlight) div.className += ' hl';
    div.innerText = msg;
    logContainer.appendChild(div);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// MODAL
infoBtn.onclick = () => infoModal.classList.remove('hidden');
closeModalBtn.onclick = () => infoModal.classList.add('hidden');

// BENCHMARK
benchBtn.onclick = () => {
    benchBtn.innerText = "...";
    benchBtn.disabled = true;
    ipcRenderer.send('run-benchmark');
};

// ACTIONS
startBtn.onclick = () => {
    const url = urlInput.value;
    const targetViews = targetViewsInput.value;
    if (!url || targetViews <= 0) return log("ERRO: Dados inválidos.", true);

    startBtn.disabled = true;
    benchBtn.disabled = true;
    stopBtn.disabled = false;
    urlInput.disabled = true;
    targetViewsInput.disabled = true;

    ipcRenderer.send('start-bot', { url, targetViews });
};

stopBtn.onclick = () => ipcRenderer.send('stop-bot');


// IPC
ipcRenderer.on('log', (e, { msg, highlight }) => log(msg, highlight));

ipcRenderer.on('benchmark-result', (e, limit) => {
    benchBtn.innerText = "ANALISAR PC";
    benchBtn.disabled = false;
    ramHint.innerHTML = `Sugerido: <strong>${limit}</strong> janelas`;
    ramHint.style.color = '#0aff0a';
    targetViewsInput.value = limit;
});

ipcRenderer.on('update-stats', (e, { type, value }) => {
    if (type === 'active') activeEl.innerText = value;
    if (type === 'status') {
        statusEl.innerText = value;
        if (value.includes('ATIVO')) statusEl.className = 'val status-active';
        else if (value.includes('PAUSADO')) statusEl.className = 'val status-warning';
        else statusEl.className = 'val status-idle';
    }
});

ipcRenderer.on('bot-stopped', () => {
    startBtn.disabled = false;
    benchBtn.disabled = false;
    stopBtn.disabled = true;
    urlInput.disabled = false;
    targetViewsInput.disabled = false;
});
