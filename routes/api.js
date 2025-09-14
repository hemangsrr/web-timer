const express = require('express');
const router = express.Router();
const {
  listTimers,
  createTimer,
  getTimer,
  getTimerState,
  updateTimerMeta,
  deleteTimer,
  updateTimerState
} = require('../config/database');

// List timers
router.get('/timers', (req, res) => {
  listTimers((err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to list timers' });
    res.json(rows);
  });
});

// Create timer
router.post('/timers', (req, res) => {
  const { name, title } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  createTimer({ name: name.trim(), title: (title || '').trim() }, (err, timer) => {
    if (err) return res.status(500).json({ error: 'Failed to create timer' });
    res.status(201).json(timer);
  });
});

// Get timer details (meta + state)
router.get('/timers/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  getTimer(id, (err, timer) => {
    if (err) return res.status(500).json({ error: 'Failed to get timer' });
    if (!timer) return res.status(404).json({ error: 'Not found' });
    getTimerState(id, (err2, state) => {
      if (err2) return res.status(500).json({ error: 'Failed to get state' });
      res.json({ ...timer, state });
    });
  });
});

// Update timer meta (name/title)
router.patch('/timers/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const { name, title, font_family, font_size, color_hex } = req.body;
  if (!name && !title && !font_family && !font_size && !color_hex) return res.status(400).json({ error: 'No fields to update' });
  updateTimerMeta(id, { name, title, font_family, font_size, color_hex }, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to update timer' });
    // Return the updated meta
    getTimer(id, (e2, timer) => {
      if (e2) return res.status(200).json({ success: true });
      res.json({ success: true, timer });
    });
  });
});

// Delete timer
router.delete('/timers/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  deleteTimer(id, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to delete timer' });
    res.json({ success: true });
  });
});

module.exports = router;
