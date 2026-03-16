// -------------------------------------------------------
// server/index.js — Main Server Entry Point
// -------------------------------------------------------
// This is the heart of the application's back end.
// When you run "npm start", Node.js starts HERE.
//
// This file does four things:
//   1. Loads configuration (environment variables from .env)
//   2. Sets up the Express web server
//   3. Registers all the API routes
//   4. Starts the hourly background update scheduler
//
// What is Express? It's a framework (a set of pre-built tools)
// that makes it easy to build web servers in Node.js. Without
// it, we'd have to write a lot more boilerplate code to handle
// HTTP requests.
// -------------------------------------------------------

// Load environment variables from the .env file into process.env
// This must be called FIRST before anything else reads from process.env
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

// Import our route handlers (the files that define what
// each API endpoint does)
const searchRoute = require('./routes/search');
const personRoute = require('./routes/person');
const topicRoute  = require('./routes/topic');

// Import the scheduler that runs hourly updates
const { startScheduler } = require('./services/scheduler');

// Import database initialiser — creates tables on first run
const { initTables } = require('./db/database');

// -------------------------------------------------------
// CREATE THE EXPRESS APP
// -------------------------------------------------------
// Think of "app" as the web server itself. We configure it
// here and then tell it to start listening for requests.
const app = express();

// -------------------------------------------------------
// MIDDLEWARE
// -------------------------------------------------------
// Middleware is code that runs on EVERY request before it
// reaches our route handlers. Think of it as a series of
// checkpoints every request passes through.

// CORS (Cross-Origin Resource Sharing):
// Allows the frontend (running in a browser) to make requests
// to our API. Without this, browsers block requests between
// different domains/ports for security reasons.
app.use(cors());

// JSON body parser:
// Automatically parses incoming JSON data in request bodies.
// Without this, POST request bodies would just be raw text.
app.use(express.json());

// Static file server:
// Serves everything in the "public" folder as static files.
// This is how the browser gets our HTML, CSS, and JavaScript.
// e.g. a request for "/" returns public/index.html
app.use(express.static(path.join(__dirname, '..', 'public')));

// -------------------------------------------------------
// API ROUTES
// -------------------------------------------------------
// These lines tell Express which route file to use for
// which URL prefix.
//
// Any request starting with /api/search  → search.js handles it
// Any request starting with /api/person  → person.js handles it

app.use('/api/search', searchRoute);
app.use('/api/person', personRoute);
app.use('/api/topic',  topicRoute);

// -------------------------------------------------------
// FALLBACK ROUTE
// -------------------------------------------------------
// For any URL that isn't an API route, serve index.html.
// This supports "client-side routing" — where the frontend
// JavaScript handles navigation between pages without
// reloading from the server.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// -------------------------------------------------------
// GLOBAL ERROR HANDLER
// -------------------------------------------------------
// If any route throws an unhandled error, this catches it
// and returns a clean JSON error message instead of crashing.
// The "next" parameter signals Express this is an error handler.
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err.stack);
  res.status(500).json({
    error: 'An internal server error occurred.',
    message: err.message
  });
});

// -------------------------------------------------------
// START THE SERVER
// -------------------------------------------------------
// Read the port from environment variables, or default to 3000.
// Port 3000 means you access the app at http://localhost:3000
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║       THE EPSTEIN INDEX                ║');
  console.log('║       Public Accountability Tool       ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  Server running at http://localhost:${PORT} ║`);
  console.log('║  API available at  /api/search         ║');
  console.log('║  API available at  /api/person/:slug   ║');
  console.log('║  API available at  /api/topic/:slug    ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  // Initialise database tables (creates them if they don't exist)
  try {
    await initTables();
  } catch (err) {
    console.error('[server] Database init failed:', err.message);
    console.error('[server] Check your PG_* environment variables in .env');
  }

  // Start the hourly background scheduler
  startScheduler();
});
