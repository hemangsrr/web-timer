// DOM Elements
const timerDisplay = document.getElementById('timer');
const timerTitleDisplay = document.getElementById('timerTitleDisplay');
const currentTimeDisplay = document.getElementById('current-time');
const hoursInput = document.getElementById('hours');
const minutesInput = document.getElementById('minutes');
const secondsInput = document.getElementById('seconds');
const targetDateInput = document.getElementById('targetDate');
const targetTimeInput = document.getElementById('targetTime');
const startToTargetBtn = document.getElementById('btnStartToTarget');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const showMillisecondsCheck = document.getElementById('showMilliseconds');
const autoRestartCheck = document.getElementById('autoRestart');
const timerEndModal = new bootstrap.Modal(document.getElementById('timerEndModal'));
const timersList = document.getElementById('timersList');
const btnNewTimer = document.getElementById('btnNewTimer');
const btnSaveMeta = document.getElementById('btnSaveMeta');
const btnCopyObs = document.getElementById('btnCopyObs');
const timerNameInput = document.getElementById('timerName');
const timerTitleInput = document.getElementById('timerTitle');
const fontFamilySelect = document.getElementById('fontFamily');
const fontSizeInput = document.getElementById('fontSize');
const fontColorInput = document.getElementById('fontColor');
const btnSaveStyle = document.getElementById('btnSaveStyle');

// Socket.io connection to /timer namespace
const socket = io('/timer');

// App state
let currentTimerId = null;
let timer;
let timeLeft = 0;
let isRunning = false;
let isPaused = false;
let endTime;

// Update current time display
function updateCurrentTime() {
    const now = new Date();
    currentTimeDisplay.textContent = `Current Time: ${now.toLocaleTimeString()}`;
}

function applyStyle({ fontFamily, fontSize, colorHex }) {
    if (fontFamily) timerDisplay.style.fontFamily = fontFamily;
    if (fontSize) timerDisplay.style.fontSize = `${fontSize}px`;
    if (colorHex) timerDisplay.style.color = colorHex;
}

// Update the timer display
function updateDisplay() {
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;
    
    if (showMillisecondsCheck.checked) {
        const milliseconds = Math.floor((endTime - Date.now()) % 1000);
        timerDisplay.textContent = 
            `${hours.toString().padStart(2, '0')}:` +
            `${minutes.toString().padStart(2, '0')}:` +
            `${seconds.toString().padStart(2, '0')}.` +
            `${milliseconds.toString().padStart(3, '0')}`;
    } else {
        timerDisplay.textContent = 
            `${hours.toString().padStart(2, '0')}:` +
            `${minutes.toString().padStart(2, '0')}:` +
            `${seconds.toString().padStart(2, '0')}`;
    }
}

// Start the timer
function startTimer() {
    if (isRunning && !isPaused) return;
    
    // If not paused, set the initial time left
    if (!isPaused) {
        const hours = parseInt(hoursInput.value) || 0;
        const minutes = parseInt(minutesInput.value) || 0;
        const seconds = parseInt(secondsInput.value) || 0;
        timeLeft = hours * 3600 + minutes * 60 + seconds;
        
        if (timeLeft <= 0) {
            alert('Please set a valid time');
            return;
        }
        
        endTime = Date.now() + (timeLeft * 1000);
    } else {
        // If paused, adjust the end time based on current time
        endTime = Date.now() + (timeLeft * 1000);
        isPaused = false;
    }
    
    isRunning = true;
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    
    // Emit start event to server
    socket.emit('timer:start', {
        timerId: currentTimerId,
        hours: parseInt(hoursInput.value) || 0,
        minutes: parseInt(minutesInput.value) || 0,
        seconds: parseInt(secondsInput.value) || 0,
        endTime: endTime
    });
    
    // Start the timer
    timer = setInterval(updateTimer, 10);
}

// Pause the timer
function pauseTimer() {
    if (!isRunning) return;
    
    clearInterval(timer);
    isPaused = true;
    isRunning = false;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    
    // Emit pause event to server
    socket.emit('timer:pause', { timeLeft, timerId: currentTimerId });
}

// Reset the timer
function resetTimer() {
    clearInterval(timer);
    isRunning = false;
    isPaused = false;
    timeLeft = 0;
    
    // Reset display
    updateDisplay();
    
    // Reset buttons
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    
    // Remove any timer-ended styling
    timerDisplay.classList.remove('timer-ended');
    
    // Emit reset event to server
    socket.emit('timer:reset', { timerId: currentTimerId });
}

// Update the timer
function updateTimer() {
    timeLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    
    if (timeLeft <= 0) {
        timerComplete();
        return;
    }
    
    updateDisplay();
}

// Handle timer completion
function timerComplete() {
    clearInterval(timer);
    isRunning = false;
    timeLeft = 0;
    updateDisplay();
    
    // Add visual feedback
    timerDisplay.classList.add('timer-ended');
    
    // Show modal
    timerEndModal.show();
    
    // Auto-restart if enabled
    if (autoRestartCheck.checked) {
        setTimeout(() => {
            timerDisplay.classList.remove('timer-ended');
            startTimer();
        }, 1000);
    } else {
        startBtn.disabled = false;
        pauseBtn.disabled = true;
    }
    
    // Emit complete event to server
    socket.emit('timer:complete', { timerId: currentTimerId });
}

// Socket event listeners
socket.on('timer:update', (data) => {
    if (data.timerId && data.timerId !== currentTimerId) return;
    if (data.timeLeft !== undefined) {
        timeLeft = data.timeLeft;
        updateDisplay();
    }
});

// New sync event handler
socket.on('timer:sync', (data) => {
    if (data.timerId && data.timerId !== currentTimerId) return;
    // Update timer state
    isRunning = data.isRunning;
    isPaused = data.isPaused;
    timeLeft = data.timeLeft;
    endTime = data.endTime;
    
    // Update input fields
    hoursInput.value = data.hours || 0;
    minutesInput.value = data.minutes || 5;
    secondsInput.value = data.seconds || 0;
    
    // Update UI
    startBtn.disabled = isRunning && !isPaused;
    pauseBtn.disabled = !isRunning || isPaused;
    
    // Start the timer if needed
    if (isRunning && !isPaused) {
        if (timer) clearInterval(timer);
        timer = setInterval(updateTimer, 10);
        
        // Update the display immediately
        updateDisplay();
    } else if (isPaused) {
        updateDisplay();
    }
});

socket.on('timer:start', (data) => {
    if (data.timerId && data.timerId !== currentTimerId) return;
    if (!isRunning || isPaused) {
        endTime = data.endTime;
        timeLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        
        // Update input fields if not already set
        if (hoursInput.value === '0' || isPaused) {
            hoursInput.value = data.hours || 0;
        }
        if (minutesInput.value === '5' || isPaused) {
            minutesInput.value = data.minutes || 5;
        }
        if (secondsInput.value === '0' || isPaused) {
            secondsInput.value = data.seconds || 0;
        }
        
        isRunning = true;
        isPaused = false;
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        
        if (timer) clearInterval(timer);
        timer = setInterval(updateTimer, 10);
        
        // Update the display immediately
        updateDisplay();
    }
});

socket.on('timer:pause', (data) => {
    if (data.timerId && data.timerId !== currentTimerId) return;
    if (isRunning) {
        clearInterval(timer);
        timeLeft = data.timeLeft;
        isRunning = false;
        isPaused = true;
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        updateDisplay();
    }
});

socket.on('timer:reset', (data) => {
    if (data && data.timerId && data.timerId !== currentTimerId) return;
    clearInterval(timer);
    isRunning = false;
    isPaused = false;
    timeLeft = 0;
    updateDisplay();
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    timerDisplay.classList.remove('timer-ended');
    
    // Reset inputs if they were changed by another client
    if (hoursInput.value !== '0') hoursInput.value = '0';
    if (minutesInput.value !== '5') minutesInput.value = '5';
    if (secondsInput.value !== '0') secondsInput.value = '0';
});

socket.on('timer:complete', (data) => {
    if (data && data.timerId && data.timerId !== currentTimerId) return;
    if (isRunning) {
        timerComplete();
    }
});

// Apply style updates from other clients
socket.on('style:update', (data) => {
    if (!data || data.timerId !== currentTimerId) return;
    const fontFamily = data.font_family;
    const fontSize = data.font_size;
    const colorHex = data.color_hex;
    applyStyle({ fontFamily, fontSize, colorHex });
    // Update form fields to reflect change
    if (fontFamily) fontFamilySelect.value = fontFamily;
    if (typeof fontSize === 'number') fontSizeInput.value = fontSize;
    if (colorHex) fontColorInput.value = colorHex;
});

// Event Listeners
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

showMillisecondsCheck.addEventListener('change', updateDisplay);

// Input validation
[hoursInput, minutesInput, secondsInput].forEach(input => {
    input.addEventListener('input', (e) => {
        let value = e.target.value;
        if (value === '') return;
        
        let num = parseInt(value) || 0;
        
        // Enforce max values
        if (e.target === hoursInput) {
            num = Math.min(99, Math.max(0, num));
        } else {
            num = Math.min(59, Math.max(0, num));
        }
        
        e.target.value = num;
    });
});

// Helpers: API calls
async function fetchJSON(url, options = {}) {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function renderTimersList(items) {
    timersList.innerHTML = '';
    items.forEach(t => {
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';

        const link = document.createElement('a');
        link.href = '#';
        link.textContent = t.name;
        link.dataset.id = t.id;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            selectTimer(t.id);
        });

        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-outline-danger';
        btn.innerHTML = '<i class="bi bi-trash"></i>';
        btn.title = 'Delete timer';
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (!confirm(`Delete timer "${t.name}"? This cannot be undone.`)) return;
            await deleteTimerById(t.id);
        });

        item.appendChild(link);
        item.appendChild(btn);
        timersList.appendChild(item);
    });
}

async function deleteTimerById(id) {
    try {
        await fetchJSON(`/api/timers/${id}`, { method: 'DELETE' });
        const items = await fetchJSON('/api/timers');
        renderTimersList(items);
        // If the current timer was deleted, select first available
        if (currentTimerId === id) {
            if (items.length > 0) {
                selectTimer(items[0].id);
            } else {
                // Clear UI if no timers left
                currentTimerId = null;
                timerNameInput.value = '';
                timerTitleInput.value = '';
                timerTitleDisplay.textContent = '';
                hoursInput.value = 0;
                minutesInput.value = 5;
                secondsInput.value = 0;
                resetTimer();
                btnCopyObs.disabled = true;
            }
        }
    } catch (e) {
        alert('Failed to delete timer');
        console.error(e);
    }
}

async function loadTimersAndSelectFirst() {
    const items = await fetchJSON('/api/timers');
    renderTimersList(items);
    if (items.length > 0) {
        selectTimer(items[0].id);
    }
}

async function selectTimer(timerId) {
    currentTimerId = timerId;
    // Enable OBS link button
    btnCopyObs.disabled = false;
    // Join socket room
    socket.emit('room:join', { timerId });
    // Get meta + state
    const data = await fetchJSON(`/api/timers/${timerId}`);
    timerNameInput.value = data.name || '';
    timerTitleInput.value = data.title || '';
    timerTitleDisplay.textContent = data.title || '';

    // Load and apply style
    const fontFamily = data.font_family || 'Courier New';
    const fontSize = data.font_size || 72;
    const colorHex = data.color_hex || '#0d6efd';
    fontFamilySelect.value = fontFamily;
    fontSizeInput.value = fontSize;
    fontColorInput.value = colorHex;
    applyStyle({ fontFamily, fontSize, colorHex });

    const state = data.state || {};
    isRunning = state.is_running === 1;
    isPaused = state.is_paused === 1;
    timeLeft = state.time_left || 0;
    endTime = state.end_time || (Date.now() + timeLeft * 1000);

    // Update inputs with remaining time
    const h = Math.floor(timeLeft / 3600);
    const m = Math.floor((timeLeft % 3600) / 60);
    const s = timeLeft % 60;
    hoursInput.value = h;
    minutesInput.value = m;
    secondsInput.value = s;

    // Update buttons
    startBtn.disabled = isRunning && !isPaused;
    pauseBtn.disabled = !isRunning || isPaused;

    // Start interval if running
    if (timer) clearInterval(timer);
    if (isRunning && !isPaused) {
        timer = setInterval(updateTimer, 10);
    } else {
        updateDisplay();
    }
}

// New timer
btnNewTimer.addEventListener('click', async () => {
    const name = prompt('Enter timer name');
    if (!name) return;
    await fetchJSON('/api/timers', {
        method: 'POST',
        body: JSON.stringify({ name, title: '' })
    });
    await loadTimersAndSelectFirst();
});

// Save meta
btnSaveMeta.addEventListener('click', async () => {
    if (!currentTimerId) return;
    await fetchJSON(`/api/timers/${currentTimerId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: timerNameInput.value, title: timerTitleInput.value })
    });
    timerTitleDisplay.textContent = timerTitleInput.value || '';
    // Reload list to reflect name change
    const items = await fetchJSON('/api/timers');
    renderTimersList(items);
});

// Save style
btnSaveStyle.addEventListener('click', async () => {
    if (!currentTimerId) return;
    const payload = {
        font_family: fontFamilySelect.value,
        font_size: parseInt(fontSizeInput.value) || 72,
        color_hex: fontColorInput.value
    };
    const res = await fetchJSON(`/api/timers/${currentTimerId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
    });
    // Apply locally
    applyStyle({ fontFamily: payload.font_family, fontSize: payload.font_size, colorHex: payload.color_hex });
    // Notify others (embed/clients)
    socket.emit('style:update', { timerId: currentTimerId, ...payload });
});

// Copy OBS link
btnCopyObs.addEventListener('click', () => {
    if (!currentTimerId) return;
    const url = `${window.location.origin}/embed/${currentTimerId}`;
    navigator.clipboard.writeText(url);
    btnCopyObs.textContent = 'Copied!';
    setTimeout(() => (btnCopyObs.innerHTML = '<i class="bi bi-copy"></i> Copy OBS Link'), 1500);
});

// Start to target timestamp
startToTargetBtn.addEventListener('click', () => {
    if (!targetDateInput.value || !targetTimeInput.value) {
        alert('Please select both a target date and time');
        return;
    }
    const target = new Date(`${targetDateInput.value}T${targetTimeInput.value}`).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.ceil((target - now) / 1000));
    if (diffSec <= 0) {
        alert('Target must be in the future');
        return;
    }
    hoursInput.value = Math.floor(diffSec / 3600);
    minutesInput.value = Math.floor((diffSec % 3600) / 60);
    secondsInput.value = diffSec % 60;
    // endTime should be the target
    endTime = target;
    isPaused = false;
    isRunning = true;
    startBtn.disabled = true;
    pauseBtn.disabled = false;

    socket.emit('timer:start', {
        timerId: currentTimerId,
        hours: parseInt(hoursInput.value) || 0,
        minutes: parseInt(minutesInput.value) || 0,
        seconds: parseInt(secondsInput.value) || 0,
        endTime: endTime
    });

    if (timer) clearInterval(timer);
    timer = setInterval(updateTimer, 10);
});

// Initialize
updateCurrentTime();
setInterval(updateCurrentTime, 1000);
updateDisplay();

document.addEventListener('DOMContentLoaded', () => {
    loadTimersAndSelectFirst();
});
