// ---------------- Constants & Globals ----------------
const GRID_SIZE = 6; // max attempts
const STATS_KEY = 'erdle_stats_v1';
const ATTEMPTS_KEY = 'erdle_attempts_v1';

let bosses = [];
let target = null;
let attempts = [];
let gameOver = false;

// DOM Elements
const input = document.getElementById('guess-input');
const btn = document.getElementById('guess-btn');
const grid = document.getElementById('grid');
const feedback = document.getElementById('feedback');
const streakEl = document.getElementById('streak');
const winsEl = document.getElementById('wins');
const playedEl = document.getElementById('played');
const answerReveal = document.getElementById('answer-reveal');
const answerName = document.getElementById('answer-name');

// ---------------- Utilities ----------------
function sanitizeName(name){
    return name.trim().toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ');
}

function compareGuess(guess, target) {
    return {
        name: sanitizeName(guess.name) === sanitizeName(target.name),
        region: guess.region.toLowerCase() === target.region.toLowerCase(),
        type: guess.type.toLowerCase() === target.type.toLowerCase(),
        damage: guess.damage.toLowerCase() === target.damage.toLowerCase(),
        remembrance: Boolean(guess.Remembrance) === Boolean(target.Remembrance)
    };
}

function findBossByName(name){
    const s = sanitizeName(name);
    return bosses.find(b => sanitizeName(b.name) === s || sanitizeName(b.short||'') === s);
}

// ---------------- Date & Daily Boss (EST) ----------------
function dateToDayIndex(d = new Date()) {
    const epoch = new Date('2004-03-06T00:00:00Z'); // fixed epoch
    // convert d to EST
    const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const estOffset = -4; // UTC-4 for EST (adjust for DST if needed)
    const estTime = utc + estOffset * 3600000;
    return Math.floor((estTime - epoch.getTime()) / (24*60*60*1000));
}

function pickDailyBoss() {
    const index = dateToDayIndex(); // deterministic boss based on day
    return bosses[index % bosses.length];
}

// ---------------- Stats ----------------
function loadStats(){
    const raw = localStorage.getItem(STATS_KEY);
    if(!raw) return {streak:0, wins:0, played:0};
    try { return JSON.parse(raw); } catch { return {streak:0, wins:0, played:0}; }
}

function saveStats(stats){
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function updateStatsUI(){
    const stats = loadStats();
    streakEl.textContent = stats.streak;
    winsEl.textContent = stats.wins;
    playedEl.textContent = stats.played;
}

// ---------------- Grid ----------------
function makeHeaderRow(){
    if(grid.querySelector('.header-row')) return;
    const row = document.createElement('div');
    row.className = 'attr-grid header-row';
    ['Name','Region','Type','Damage','Remembrance'].forEach(text=>{
        const cell = document.createElement('div');
        cell.className = 'attr-header';
        cell.textContent = text;
        row.appendChild(cell);
    });
    grid.appendChild(row);
}

function makeEmptyRow(){
    const row = document.createElement('div');
    row.className = 'guess-row';
    for(let i=0;i<5;i++){
        const cell = document.createElement('div');
        cell.className = 'guess-cell bad';
        cell.textContent = '—';
        row.appendChild(cell);
    }
    grid.appendChild(row);
    return row;
}

function updateRowWithGuess(row,boss){
    const cells = row.querySelectorAll('.guess-cell');
    const comp = compareGuess(boss,target);
    const attrs = ['name','region','type','damage','remembrance'];
    attrs.forEach((k,i)=>{
        if(k === 'remembrance'){
            cells[i].textContent = boss.Remembrance ? 'Yes' : 'No';
        } else {
            cells[i].textContent = boss[k];
        }
        cells[i].className = 'guess-cell ' + (comp[k] ? 'good':'bad');
    });
}

// ---------------- Autocomplete ----------------
function initAutocomplete(){
    const list = document.getElementById('bosses-list');
    bosses.forEach(b=>{
        const opt = document.createElement('option');
        opt.value = b.name;
        list.appendChild(opt);
    });
}

// ---------------- Game Logic ----------------
function initializeGame(){
    target = pickDailyBoss(); // deterministic daily boss

    attempts = JSON.parse(localStorage.getItem(ATTEMPTS_KEY)||'[]');
    gameOver = attempts.some(a => sanitizeName(a.name)===sanitizeName(target.name)) || attempts.length >= GRID_SIZE;

    grid.innerHTML = '';
    makeHeaderRow();

    attempts.forEach(b => {
        const row = makeEmptyRow();
        updateRowWithGuess(row,b);
    });

    if(!gameOver && attempts.length < GRID_SIZE) makeEmptyRow();

    updateStatsUI();
    feedback.textContent = '';
    answerReveal.classList.add('hidden');

    if(gameOver){
        revealAnswer();
        showOverlay(attempts.some(a => sanitizeName(a.name)===sanitizeName(target.name)));
    }
}

// ---------------- Handle Guess ----------------
function handleGuess(){
    if(gameOver){ showOverlay(attempts.some(a => sanitizeName(a.name)===sanitizeName(target.name))); return; }

    const val = input.value.trim();
    const boss = findBossByName(val);
    if(!boss){ feedback.textContent='Invalid boss name.'; return; }
    if(attempts.some(a => sanitizeName(a.name)===sanitizeName(boss.name))){ feedback.textContent='You already guessed that boss!'; return; }

    const lastRow = grid.querySelector('.guess-row:last-child');
    updateRowWithGuess(lastRow,boss);
    attempts.push(boss);
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));

    const cells = lastRow.querySelectorAll('.guess-cell');
    cells.forEach((c,i)=>{
        setTimeout(()=>c.classList.add('bounce'), i*100);
        setTimeout(()=>c.classList.remove('bounce'), i*100+600);
    });

    if(sanitizeName(boss.name)===sanitizeName(target.name)){
        feedback.textContent='You win!';
        gameOver = true;
        revealAnswer();
        updateGameStats(true);
        setTimeout(()=>showOverlay(true), 800);
    } else if(attempts.length >= GRID_SIZE){
        gameOver = true;
        revealAnswer();
        updateGameStats(false);
        setTimeout(()=>showOverlay(false), 800);
    } else {
        makeEmptyRow();
    }

    input.value = '';
}

// ---------------- Reveal Answer & Stats ----------------
function revealAnswer(){ 
    answerName.textContent = target.name; 
    answerReveal.classList.remove('hidden'); 
}

function updateGameStats(win){
    const stats = loadStats();
    stats.played++;
    if(win){ stats.wins++; stats.streak++; } else stats.streak=0;
    saveStats(stats);
    updateStatsUI();
}

// ---------------- Overlay ----------------
function showOverlay(isWin){
    const overlay = document.getElementById('win-overlay');
    if(!overlay) return;

    const title = overlay.querySelector('#overlay-title');
    const text = overlay.querySelector('#overlay-text');
    const shareBtn = overlay.querySelector('#overlay-share');
    const closeBtn = overlay.querySelector('#win-close');

    closeBtn.onclick = ()=>overlay.classList.add('hidden');

    if(isWin){
        title.textContent = 'You Win!';
        text.innerHTML = attempts.map(a=>{
            const comp = compareGuess(a,target);
            return ['name','region','type','damage','remembrance'].map(k=>comp[k]?'🟩':'⬛').join('');
        }).join('<br>');

        shareBtn.style.display = 'inline-block';
        shareBtn.onclick = ()=>{
            const today = new Date();
            const mm = ('0'+(today.getMonth()+1)).slice(-2);
            const dd = ('0'+today.getDate()).slice(-2);
            const yyyy = today.getFullYear();
            const header = `Erdle ${mm}/${dd}/${yyyy} ${attempts.length}/${GRID_SIZE}\n`;
            const gridStr = attempts.map(a=>{
                const comp = compareGuess(a,target);
                return ['name','region','type','damage','remembrance'].map(k=>comp[k]?'🟩':'⬛').join('');
            }).join('\n');
            navigator.clipboard.writeText(header+gridStr).then(()=>alert('Copied to clipboard!'));
        };
    } else {
        title.textContent = 'Game Over!';
        text.innerHTML = `The boss was <strong>${target.name}</strong>.`;
        shareBtn.style.display='none';
    }

    let countdownEl = overlay.querySelector('#overlay-countdown');
    if(!countdownEl){
        countdownEl = document.createElement('p');
        countdownEl.id = 'overlay-countdown';
        overlay.querySelector('#win-content').appendChild(countdownEl);
    }

    function updateCountdown(){
        const now = new Date();
        const utcNow = new Date(now.getTime() + now.getTimezoneOffset()*60000);

        const estOffset = -4; // EST = UTC-4
        const estNow = new Date(utcNow.getTime() + estOffset*3600000);

        const tomorrowEstMidnight = new Date(estNow.getFullYear(), estNow.getMonth(), estNow.getDate()+1,0,0,0);
        const diff = tomorrowEstMidnight.getTime() - estNow.getTime();

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000)/60000);
        const s = Math.floor((diff % 60000)/1000);
        countdownEl.textContent = `Next game in ${h}h ${m}m ${s}s`;
    }

    updateCountdown();
    setInterval(updateCountdown,1000);

    overlay.classList.remove('hidden');
}

// ---------------- Events ----------------
btn.addEventListener('click', handleGuess);
input.addEventListener('keypress', e=>{ if(e.key==='Enter') handleGuess(); });

// ---------------- Load Bosses ----------------
fetch('bosses.json')
.then(r => r.json())
.then(data => {
    bosses = data;
    initializeGame();
    initAutocomplete();
})
.catch(err => {
    console.error('Error loading bosses:', err);
    feedback.textContent = 'Error loading boss data.';
});
