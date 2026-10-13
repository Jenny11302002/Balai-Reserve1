/**
 * PostgreSQL Database Adapter
 * Uses pg (node-postgres) for connection pooling
 */
'use strict';

const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err);
});

/**
 * Statement wrapper for SQLite-like API
 */
class Statement {
  constructor(sql, params = []) {
    this.sql = sql;
    this.params = params;
  }

  async get(...bindParams) {
    const params = bindParams.length > 0 ? bindParams : this.params;
    try {
      const result = await pool.query(this.sql, params);
      return result.rows[0];
    } catch (error) {
      console.error('Postgres query error:', error.message);
      console.error('SQL:', this.sql);
      console.error('Params:', params);
      throw error;
    }
  }

  async all(...bindParams) {
    const params = bindParams.length > 0 ? bindParams : this.params;
    try {
      const result = await pool.query(this.sql, params);
      return result.rows;
    } catch (error) {
      console.error('Postgres query error:', error.message);
      console.error('SQL:', this.sql);
      console.error('Params:', params);
      throw error;
    }
  }

  async run(...bindParams) {
    const params = bindParams.length > 0 ? bindParams : this.params;
    try {
      const result = await pool.query(this.sql, params);
      return {
        changes: result.rowCount,
        lastInsertRowid: result.rows[0]?.id || null,
      };
    } catch (error) {
      console.error('Postgres query error:', error.message);
      console.error('SQL:', this.sql);
      console.error('Params:', params);
      throw error;
    }
  }
}

/**
 * Database wrapper with SQLite-compatible API
 */
const database = {
  prepare(sql) {
    // Convert SQLite syntax to Postgres
    let pgSql = sql
      // Replace datetime('now') with NOW()
      .replace(/datetime\('now'\)/gi, 'NOW()')
      // Replace || concatenation with CONCAT()
      .replace(/(\w+)\s*\|\|\s*'([^']+)'\s*\|\|\s*(\w+)/g, "CONCAT($1, '$2', $3)")
      // Replace SUBSTR with SUBSTRING
      .replace(/SUBSTR\(/gi, 'SUBSTRING(')
      // Replace ? placeholders with $1, $2, etc.
      .replace(/\?/g, () => {
        let count = (pgSql.match(/\$/g) || []).length;
        return `$${count + 1}`;
      });

    return new Statement(pgSql);
  },

  async query(sql, params = []) {
    try {
      const result = await pool.query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('Postgres direct query error:', error.message);
      throw error;
    }
  },

  pragma() {
    // No-op for Postgres (SQLite compatibility)
    return this;
  },

  async close() {
    await pool.end();
  },

  // Expose pool for advanced usage
  getPool() {
    return pool;
  },
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

module.exports = database;
