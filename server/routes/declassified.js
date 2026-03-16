// -------------------------------------------------------
// routes/declassified.js — Declassified Programs API
// -------------------------------------------------------
// GET /api/declassified
//
// Returns the curated list of declassified government
// programs for the frontend to render on the home page.
// These are static reference links — no live search,
// just pointers to official primary sources.
// -------------------------------------------------------

const express = require('express');
const router  = express.Router();

const { PROGRAMS, PROGRAM_CATEGORIES } = require('../data/declassified');

router.get('/', (req, res) => {
  res.json({ programs: PROGRAMS, categories: PROGRAM_CATEGORIES });
});

module.exports = router;
