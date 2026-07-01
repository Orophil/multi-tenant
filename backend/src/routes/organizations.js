'use strict';

const express = require('express');

const { query } = require('../db');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

router.use(authenticate, requireSuperAdmin);

// POST /api/organizations
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const trimmed = name.trim();

    const existing = await query('SELECT id FROM organizations WHERE lower(name) = lower($1)', [
      trimmed,
    ]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Organization name already exists' });
    }

    const result = await query(
      'INSERT INTO organizations (name) VALUES ($1) RETURNING id, name, created_at',
      [trimmed]
    );
    return res.status(201).json(result.rows[0]);
  })
);

// GET /api/organizations
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await query(
      'SELECT id, name, created_at FROM organizations ORDER BY created_at DESC'
    );
    return res.status(200).json(result.rows);
  })
);

module.exports = router;
