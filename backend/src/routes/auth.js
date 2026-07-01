'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { query } = require('../db');
const config = require('../config');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

const VALID_SIGNUP_ROLES = ['org_admin', 'end_user'];

function signToken(payload) {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
}

// POST /api/auth/super-admin/login
router.post(
  '/super-admin/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    if (email !== config.superAdmin.email || password !== config.superAdmin.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken({
      userId: null,
      role: 'super_admin',
      orgId: null,
      email: config.superAdmin.email,
    });
    return res.status(200).json({
      token,
      user: { email: config.superAdmin.email, role: 'super_admin' },
    });
  })
);

// POST /api/auth/signup
router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { email, password, organizationName, role } = req.body || {};

    if (!email || !password || !organizationName || !role) {
      return res
        .status(400)
        .json({ error: 'email, password, organizationName and role are required' });
    }
    if (!VALID_SIGNUP_ROLES.includes(role)) {
      return res.status(400).json({ error: 'role must be org_admin or end_user' });
    }

    const orgResult = await query(
      'SELECT id, name FROM organizations WHERE lower(name) = lower($1)',
      [organizationName]
    );
    if (orgResult.rowCount === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    const org = orgResult.rows[0];

    const existing = await query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const roleResult = await query('SELECT id FROM roles WHERE name = $1', [role]);
    if (roleResult.rowCount === 0) {
      return res.status(400).json({ error: 'role must be org_admin or end_user' });
    }
    const roleId = roleResult.rows[0].id;

    const passwordHash = await bcrypt.hash(password, 10);

    const insert = await query(
      `INSERT INTO users (email, password_hash, role_id, org_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email`,
      [email, passwordHash, roleId, org.id]
    );
    const user = insert.rows[0];

    const token = signToken({
      userId: user.id,
      role,
      orgId: org.id,
      email: user.email,
    });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role,
        orgId: org.id,
        organizationName: org.name,
      },
    });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const result = await query(
      `SELECT u.id, u.email, u.password_hash, u.org_id,
              r.name AS role, o.name AS organization_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       JOIN organizations o ON o.id = u.org_id
       WHERE lower(u.email) = lower($1)`,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      orgId: user.org_id,
      email: user.email,
    });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        orgId: user.org_id,
        organizationName: user.organization_name,
      },
    });
  })
);

module.exports = router;
