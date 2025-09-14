// Embed script for OBS/browser source to display a single timer
// Requires window.EMBED_TIMER_ID set by the server-side template

const embedTimerEl = document.getElementById('embed-timer');
const embedTitleEl = document.getElementById('embed-title');
const timerId = window.EMBED_TIMER_ID;

const socket = io('/timer');

let endTime = null;
let isRunning = false;
let isPaused = false;
let timeLeft = 0;
let intervalId;

function updateDisplay() {
  const h = Math.floor(timeLeft / 3600).toString().padStart(2, '0');
  const m = Math.floor((timeLeft % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(timeLeft % 60).toString().padStart(2, '0');
  embedTimerEl.textContent = `${h}:${m}:${s}`;
}

function tick() {
  timeLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  updateDisplay();
  if (timeLeft <= 0) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

async function fetchTimerMeta() {
  try {
    const res = await fetch(`/api/timers/${timerId}`);
    if (!res.ok) return;
    const data = await res.json();
    embedTitleEl.textContent = data.title || '';
    // apply style
    if (data.font_family) embedTimerEl.style.fontFamily = data.font_family;
    if (data.font_size) embedTimerEl.style.fontSize = `${data.font_size}px`;
    if (data.color_hex) embedTimerEl.style.color = data.color_hex;
  } catch (e) {
    // ignore
  }
}

socket.on('connect', () => {
  socket.emit('room:join', { timerId });
  fetchTimerMeta();
});

socket.on('timer:sync', (data) => {
  if (data.timerId !== timerId) return;
  isRunning = data.isRunning;
  isPaused = data.isPaused;
  timeLeft = data.timeLeft || 0;
  endTime = data.endTime || (Date.now() + timeLeft * 1000);
  updateDisplay();
  if (intervalId) clearInterval(intervalId);
  if (isRunning && !isPaused) {
    intervalId = setInterval(tick, 200);
  }
});

socket.on('timer:update', (data) => {
  if (data.timerId !== timerId) return;
  timeLeft = data.timeLeft;
  updateDisplay();
});

socket.on('timer:start', (data) => {
  if (data.timerId !== timerId) return;
  endTime = data.endTime;
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(tick, 200);
});

socket.on('timer:pause', (data) => {
  if (data.timerId !== timerId) return;
  if (intervalId) clearInterval(intervalId);
  timeLeft = data.timeLeft;
  updateDisplay();
});

socket.on('timer:reset', (data) => {
  if (!data || data.timerId !== timerId) return;
  if (intervalId) clearInterval(intervalId);
  timeLeft = 0;
  endTime = null;
  updateDisplay();
});

socket.on('timer:complete', (data) => {
  if (!data || data.timerId !== timerId) return;
  if (intervalId) clearInterval(intervalId);
  timeLeft = 0;
  updateDisplay();
});

// Listen for style updates
socket.on('style:update', (data) => {
  if (!data || data.timerId !== timerId) return;
  if (data.font_family) embedTimerEl.style.fontFamily = data.font_family;
  if (typeof data.font_size === 'number') embedTimerEl.style.fontSize = `${data.font_size}px`;
  if (data.color_hex) embedTimerEl.style.color = data.color_hex;
});

updateDisplay();
