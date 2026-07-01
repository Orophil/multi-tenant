'use strict';

const express = require('express');

const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

router.use(authenticate);

// POST /api/flags/check  (any authenticated user with an orgId)
router.post(
  '/check',
  asyncHandler(async (req, res) => {
    const { feature_key: featureKey } = req.body || {};
    if (!featureKey || typeof featureKey !== 'string') {
      return res.status(400).json({ error: 'feature_key is required' });
    }
    const orgId = req.user.orgId;
    if (!orgId) {
      return res.status(403).json({ error: 'User is not associated with an organization' });
    }

    const orgResult = await query('SELECT name FROM organizations WHERE id = $1', [orgId]);
    if (orgResult.rowCount === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    const organizationName = orgResult.rows[0].name;

    const flagResult = await query(
      'SELECT enabled FROM feature_flags WHERE org_id = $1 AND feature_key = $2',
      [orgId, featureKey]
    );
    const enabled = flagResult.rowCount > 0 ? flagResult.rows[0].enabled : false;

    return res.status(200).json({ feature_key: featureKey, enabled, organizationName });
  })
);

// All routes below require org_admin
router.use(requireRole('org_admin'));

// GET /api/flags
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id, feature_key, enabled, created_at, updated_at
       FROM feature_flags
       WHERE org_id = $1
       ORDER BY created_at DESC`,
      [req.user.orgId]
    );
    return res.status(200).json(result.rows);
  })
);

// POST /api/flags
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { feature_key: featureKey, enabled } = req.body || {};
    if (!featureKey || typeof featureKey !== 'string' || !featureKey.trim()) {
      return res.status(400).json({ error: 'feature_key is required' });
    }
    const enabledValue = enabled === undefined ? false : Boolean(enabled);

    const existing = await query(
      'SELECT id FROM feature_flags WHERE org_id = $1 AND feature_key = $2',
      [req.user.orgId, featureKey]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Feature flag already exists for this organization' });
    }

    const result = await query(
      `INSERT INTO feature_flags (org_id, feature_key, enabled)
       VALUES ($1, $2, $3)
       RETURNING id, feature_key, enabled, created_at, updated_at`,
      [req.user.orgId, featureKey, enabledValue]
    );
    return res.status(201).json(result.rows[0]);
  })
);

// PATCH /api/flags/:id
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid flag id' });
    }
    const { enabled, feature_key: featureKey } = req.body || {};

    const sets = [];
    const params = [];
    let idx = 1;

    if (enabled !== undefined) {
      sets.push(`enabled = $${idx++}`);
      params.push(Boolean(enabled));
    }
    if (featureKey !== undefined) {
      if (typeof featureKey !== 'string' || !featureKey.trim()) {
        return res.status(400).json({ error: 'feature_key must be a non-empty string' });
      }
      sets.push(`feature_key = $${idx++}`);
      params.push(featureKey);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    sets.push('updated_at = now()');

    params.push(id);
    params.push(req.user.orgId);

    try {
      const result = await query(
        `UPDATE feature_flags
         SET ${sets.join(', ')}
         WHERE id = $${idx++} AND org_id = $${idx}
         RETURNING id, feature_key, enabled, created_at, updated_at`,
        params
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Feature flag not found' });
      }
      return res.status(200).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        return res
          .status(409)
          .json({ error: 'Feature flag already exists for this organization' });
      }
      throw err;
    }
  })
);

// DELETE /api/flags/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid flag id' });
    }
    const result = await query(
      'DELETE FROM feature_flags WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.orgId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }
    return res.status(204).send();
  })
);

module.exports = router;
