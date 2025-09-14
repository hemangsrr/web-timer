require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const exphbs = require('express-handlebars');

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Import routes
const timerRoutes = require('./routes/timer')(io);
const apiRouter = require('./routes/api');

// Database connection (optional, for future use)
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));
}

// View engine setup
app.engine('hbs', exphbs.engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  helpers: {
    currentYear: () => new Date().getFullYear()
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.render('index', { 
    title: 'Stream Timer',
    layout: 'main',
    includeMainJs: true
  });
});

// Embed view for OBS: show a single timer
app.get('/embed/:id', (req, res) => {
  const timerId = parseInt(req.params.id, 10);
  if (Number.isNaN(timerId)) return res.status(400).send('Invalid timer id');
  res.render('embed', {
    title: 'Timer',
    layout: 'main',
    timerId,
    includeEmbedJs: true
  });
});

// API Routes
app.use('/api', apiRouter);
app.use('/api/timer', timerRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found',
    layout: 'main'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Something went wrong!',
    message: 'An error occurred on the server.',
    layout: 'main'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop the server');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  httpServer.close(() => {
    console.log('Server has been stopped');
    process.exit(0);
  });
});
