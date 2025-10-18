// ---------------- Constants & Globals ----------------
const GRID_SIZE = 6;
const STATS_KEY = 'erdle_stats_v1';
const ATTEMPTS_KEY = 'erdle_attempts_v1';
const LAST_DATE_KEY = 'erdle_last_date';

let bosses = [];
let target = null;
let attempts = [];
let gameOver = false;
let testDayOffset = 0;
let testMode = false; // flag for test/skip-day mode

// ---------------- Time Helpers ----------------
function getESTDate(baseDate = new Date()) {
  const utc = baseDate.getTime() + baseDate.getTimezoneOffset() * 60000;
  return new Date(utc + -5 * 3600000); // UTC-5
}

function getNextMidnightEST() {
  const now = getESTDate();
  const next = new Date(now);
  next.setHours(24,0,0,0);
  return next;
}

// ---------------- Boss Selection ----------------
const startDate = new Date('2025-10-17T00:00:00-05:00'); // day 001

function daysSinceStart() {
  const now = getESTDate();
  const diff = now - startDate;
  return Math.floor(diff / (1000*60*60*24)) + testDayOffset;
}

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getBossOfTheDay() {
  const index = Math.floor(seededRandom(daysSinceStart()+1) * bosses.length);
  return bosses[index];
}

function pad(num, size) {
  let s = "000" + num;
  return s.substr(s.length - size);
}

// ---------------- DOM Elements ----------------
const gridEl = document.getElementById('grid');
const inputEl = document.getElementById('guess-input');
const btnEl = document.getElementById('guess-btn');
const feedbackEl = document.getElementById('feedback');
const bossdleDayEl = document.getElementById('bossdle-day');
const answerRevealEl = document.getElementById('answer-reveal');
const answerNameEl = document.getElementById('answer-name');
const overlay = document.getElementById('win-overlay');

// ---------------- Load Bosses ----------------
fetch('bosses.json')
  .then(r => r.json())
  .then(data => {
    bosses = data;
    populateDatalist();
    initializeGame();
  })
  .catch(err => console.error(err));

function populateDatalist() {
  const list = document.getElementById('bosses-list');
  bosses.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.name;
    list.appendChild(opt);
  });
}

// ---------------- Stats ----------------
function loadStats() {
  const stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
  document.getElementById('streak').textContent = stats.streak || 0;
  document.getElementById('wins').textContent = stats.wins || 0;
  document.getElementById('played').textContent = stats.played || 0;
}

function saveStats(win) {
  if (testMode) return; // never save stats in test mode

  const stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
  stats.streak = stats.streak || 0;
  stats.wins = stats.wins || 0;
  stats.played = stats.played || 0;

  stats.played++;
  if (win) { stats.wins++; stats.streak++; }
  else stats.streak = 0;

  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  loadStats();
}

// ---------------- Initialize Game ----------------
function initializeGame() {
  loadStats();

  const storedAttempts = testMode ? [] : JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '[]');
  attempts = storedAttempts;
  target = getBossOfTheDay();
  gameOver = false;

  gridEl.innerHTML = '';
  makeHeaderRow();
  attempts.forEach(b => updateGridRow(b, false));
  
  if (!gameOver && attempts.length < GRID_SIZE) addEmptyRow();

  const guessedCorrectly = attempts.some(a => a.name === target.name);
  if (guessedCorrectly) {
    gameOver = true;
    showWinOverlay(true);
  } else if (attempts.length >= GRID_SIZE) {
    gameOver = true;
    answerNameEl.textContent = target.name;
    answerRevealEl.classList.remove('hidden');
    showWinOverlay(false);
  }

  feedbackEl.textContent = '';
  updateBossdleDayLabel();
}

// ---------------- Header Row ----------------
function makeHeaderRow() {
  if (gridEl.querySelector('.header-row')) return;
  const row = document.createElement('div');
  row.className = 'attr-grid header-row';
  ['Name','Region','Type','Damage','Remembrance'].forEach(text => {
    const cell = document.createElement('div');
    cell.className = 'attr-header';
    cell.textContent = text;
    row.appendChild(cell);
  });
  gridEl.appendChild(row);
}

// ---------------- Empty Row ----------------
function addEmptyRow() {
  const row = document.createElement('div');
  row.classList.add('guess-row','empty-row');
  row.style.marginTop = '16px';
  for (let i=0;i<5;i++){
    const cell = document.createElement('div');
    cell.classList.add('guess-cell','bad');
    cell.textContent = '—';
    row.appendChild(cell);
  }
  gridEl.appendChild(row);
}

// ---------------- Update Grid ----------------
function updateGridRow(boss, save=true) {
  let row = gridEl.querySelector('.empty-row');
  if (!row) { 
    row = document.createElement('div');
    row.classList.add('guess-row');
    gridEl.appendChild(row);
  }
  row.classList.remove('empty-row');
  row.innerHTML = '';

  ['name','region','type','damage','Remembrance'].forEach(attr => {
    const cell = document.createElement('div');
    cell.classList.add('guess-cell');
    let val = boss[attr];
    if (typeof val==='boolean') val = val?'Yes':'No';
    cell.textContent = val;

    if (boss[attr] === target[attr]) cell.classList.add('good');
    else if (boss[attr] && target[attr] && String(boss[attr]).toLowerCase()===String(target[attr]).toLowerCase()) cell.classList.add('semi');
    else cell.classList.add('bad');

    row.appendChild(cell);
  });

  if (save) {
    attempts.push(boss);
    if (!testMode) localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
  }

  if (!gameOver && attempts.length < GRID_SIZE) addEmptyRow();
}

// ---------------- Handle Guess ----------------
function handleGuess() {
  if (gameOver) return;

  const guessVal = inputEl.value.trim();
  if (!guessVal) return;

  const boss = bosses.find(b => b.name.toLowerCase() === guessVal.toLowerCase());
  if (!boss) { feedbackEl.textContent = 'Invalid boss name.'; return; }
  if (attempts.some(a => a.name === boss.name)) { feedbackEl.textContent = 'Already guessed!'; return; }

  updateGridRow(boss);
  inputEl.value = '';

  if (boss.name === target.name) {
    gameOver = true;
    saveStats(true);
    showWinOverlay(true);
  } else if (attempts.length >= GRID_SIZE) {
    gameOver = true;
    answerNameEl.textContent = target.name;
    answerRevealEl.classList.remove('hidden');
    saveStats(false);
    showWinOverlay(false);
  } else {
    feedbackEl.textContent = 'Try again!';
  }
}

// ---------------- Overlay & Copy ----------------
document.getElementById('win-close').onclick = () => overlay.classList.add('hidden');

function showWinOverlay(win) {
  overlay.classList.remove('hidden');
  const text = document.getElementById('overlay-text');
  const shareBtn = document.getElementById('overlay-share');
  const title = document.getElementById('overlay-title');

  // Set overlay title based on win/loss
  title.textContent = win ? 'You Win!' : 'You Lose!';

  if (win) {
    const rows = gridEl.querySelectorAll('.guess-row');
    const winningRow = rows[rows.length - 1];
    const cells = winningRow.querySelectorAll('.guess-cell');
    cells.forEach((cell, i) => {
      cell.style.animationDelay = `${i * 0.1}s`;
      cell.classList.add('wave-cell');
    });

    const lastCell = cells[cells.length - 1];
    lastCell.addEventListener('animationend', () => {
      text.innerHTML = `You guessed <strong>${target.name}</strong>!<br>` + attempts.map(a => bossEmojiRow(a)).join('<br>');
      shareBtn.style.display = 'inline-block';
      shareBtn.onclick = () => copyResults(win);
    }, { once: true });

  } else {
    // For loss, no animation
    text.innerHTML = `The boss was <strong>${target.name}</strong><br>` + attempts.map(a => bossEmojiRow(a)).join('<br>');
    shareBtn.style.display = 'inline-block';
    shareBtn.onclick = () => copyResults(win);
  }
}

function bossEmojiRow(boss) {
  return ['name','region','type','damage','Remembrance'].map(attr => {
    if (boss[attr] === target[attr]) return '🟩';
    else return '⬛';
  }).join('');
}

function copyResults(win) {
  const num = daysSinceStart();
  const header = `Bossdle ${pad(num+1,3)} ${win?attempts.length:'X'}/${GRID_SIZE}\n`;
  const gridStr = attempts.map(a => bossEmojiRow(a)).join('\n');
  navigator.clipboard.writeText(header+gridStr).then(()=>alert('Copied to clipboard!'));
}

// ---------------- Bossdle Day ----------------
function updateBossdleDayLabel() {
  const dayNum = daysSinceStart();
  bossdleDayEl.textContent = `Bossdle: ${pad(dayNum+1,3)}`;
}

// ---------------- Event Listeners ----------------
btnEl.addEventListener('click', handleGuess);
inputEl.addEventListener('keyup', e => { if(e.key==='Enter') handleGuess(); });

// ---------------- Skip-Day / Test Combo ----------------
document.addEventListener('keydown', e => {
  if ((e.key === '=' || e.key === '\\')) {
    if (!window.keysPressed) window.keysPressed = {};
    window.keysPressed[e.key] = true;

    if (window.keysPressed['='] && window.keysPressed['\\']) {
      testMode = true;      // enable test mode
      testDayOffset++;
      attempts = [];         // clear in-memory attempts
      initializeGame();
      alert(`Test mode: advanced to Bossdle ${pad(daysSinceStart()+1,3)}`);
      window.keysPressed['='] = false;
      window.keysPressed['\\'] = false;
    }
  }
});

document.addEventListener('keyup', e => {
  if (window.keysPressed && (e.key === '=' || e.key === '\\')) {
    window.keysPressed[e.key] = false;
  }
});
