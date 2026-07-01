'use strict';

const { Pool } = require('pg');
const { DATABASE_URL } = require('./config');

const pool = new Pool({ connectionString: DATABASE_URL });

function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
