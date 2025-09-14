const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'timer_v2.db');

// Create a new database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize the database with required tables
function initializeDatabase() {
  db.serialize(() => {
    // Timers metadata
    db.run(`CREATE TABLE IF NOT EXISTS timers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      title TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Ensure style columns exist on timers table
    db.all('PRAGMA table_info(timers)', (err, cols) => {
      if (err) return console.error('Error reading schema for timers:', err);
      const colNames = (cols || []).map(c => c.name);
      const addColumn = (sql) => db.run(sql, (e) => e && console.error('Error adding column:', e));
      if (!colNames.includes('font_family')) addColumn("ALTER TABLE timers ADD COLUMN font_family TEXT DEFAULT 'Courier New'");
      if (!colNames.includes('font_size')) addColumn("ALTER TABLE timers ADD COLUMN font_size INTEGER DEFAULT 72");
      if (!colNames.includes('color_hex')) addColumn("ALTER TABLE timers ADD COLUMN color_hex TEXT DEFAULT '#0d6efd'");
    });

    // Per-timer state
    db.run(`CREATE TABLE IF NOT EXISTS timer_state (
      timer_id INTEGER PRIMARY KEY,
      is_running INTEGER DEFAULT 0,
      is_paused INTEGER DEFAULT 0,
      end_time INTEGER,
      hours INTEGER DEFAULT 0,
      minutes INTEGER DEFAULT 5,
      seconds INTEGER DEFAULT 0,
      time_left INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(timer_id) REFERENCES timers(id) ON DELETE CASCADE
    )`);

    // Seed default timer/state if none exists
    db.get('SELECT COUNT(*) as count FROM timers', (err, row) => {
      if (err) return console.error('Error checking timers:', err);
      if (row.count === 0) {
        db.run('INSERT INTO timers (name, title, font_family, font_size, color_hex) VALUES (?, ?, ?, ?, ?)', ['Default Timer', '', 'Courier New', 72, '#0d6efd'], function (err2) {
          if (err2) return console.error('Error seeding default timer:', err2);
          const timerId = this.lastID;
          db.run(
            `INSERT INTO timer_state (timer_id, is_running, is_paused, hours, minutes, seconds, time_left)
             VALUES (?, 0, 0, 0, 5, 0, 300)`,
            [timerId]
          );
        });
      }
    });
  });
}

// Helper: list all timers with basic info
function listTimers(callback) {
  db.all('SELECT * FROM timers ORDER BY created_at ASC', [], callback);
}

// Helper: create a new timer (and initial state)
function createTimer({ name, title }, callback) {
  db.run('INSERT INTO timers (name, title, font_family, font_size, color_hex) VALUES (?, ?, ?, ?, ?)', [name, title || '', 'Courier New', 72, '#0d6efd'], function (err) {
    if (err) return callback(err);
    const timerId = this.lastID;
    db.run(
      `INSERT INTO timer_state (timer_id, is_running, is_paused, hours, minutes, seconds, time_left)
       VALUES (?, 0, 0, 0, 5, 0, 300)`,
      [timerId],
      (err2) => {
        if (err2) return callback(err2);
        callback(null, { id: timerId, name, title: title || '' });
      }
    );
  });
}

// Helper: get timer by id
function getTimer(timerId, callback) {
  db.get('SELECT * FROM timers WHERE id = ?', [timerId], callback);
}

// Helper: get state by timer id
function getTimerState(timerId, callback) {
  db.get('SELECT * FROM timer_state WHERE timer_id = ?', [timerId], (err, row) => {
    if (err) return callback(err);
    if (!row) {
      // Create initial state if missing
      db.run(
        `INSERT INTO timer_state (timer_id, is_running, is_paused, hours, minutes, seconds, time_left)
         VALUES (?, 0, 0, 0, 5, 0, 300)`,
        [timerId],
        (err2) => {
          if (err2) return callback(err2);
          callback(null, {
            timer_id: timerId,
            is_running: 0,
            is_paused: 0,
            end_time: null,
            hours: 0,
            minutes: 5,
            seconds: 0,
            time_left: 300
          });
        }
      );
    } else {
      callback(null, row);
    }
  });
}

// Helper: update timer meta
function updateTimerMeta(timerId, { name, title, font_family, font_size, color_hex }, callback) {
  db.run('UPDATE timers SET name = COALESCE(?, name), title = COALESCE(?, title), font_family = COALESCE(?, font_family), font_size = COALESCE(?, font_size), color_hex = COALESCE(?, color_hex) WHERE id = ?', [name, title, font_family, font_size, color_hex, timerId], function (err) {
    if (err) return callback(err);
    callback(null, { changes: this.changes });
  });
}

// Helper: delete timer
function deleteTimer(timerId, callback) {
  db.run('DELETE FROM timers WHERE id = ?', [timerId], function (err) {
    if (err) return callback(err);
    callback(null, { changes: this.changes });
  });
}

// Helper: update timer state
function updateTimerState(timerId, state, callback) {
  const { is_running, is_paused, end_time, hours, minutes, seconds, time_left } = state;
  db.run(
    `UPDATE timer_state
     SET is_running = ?, is_paused = ?, end_time = ?, hours = ?, minutes = ?, seconds = ?, time_left = ?, updated_at = CURRENT_TIMESTAMP
     WHERE timer_id = ?`,
    [is_running ? 1 : 0, is_paused ? 1 : 0, end_time, hours, minutes, seconds, time_left, timerId],
    function (err) {
      if (err) return callback(err);
      callback(null, { changes: this.changes });
    }
  );
}

module.exports = {
  db,
  listTimers,
  createTimer,
  getTimer,
  getTimerState,
  updateTimerState,
  updateTimerMeta,
  deleteTimer
};
