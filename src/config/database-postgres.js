/**
 * PostgreSQL Database Adapter
 * Uses pg (node-postgres) for connection pooling
 */
'use strict';

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required for Postgres mode');
}

console.log('Initializing Postgres connection pool...');

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

console.log('✅ Postgres pool created');

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
      // For INSERT statements, add RETURNING id to get the last insert ID
      let sql = this.sql;
      const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
      
      if (isInsert && !sql.toUpperCase().includes('RETURNING')) {
        sql = sql.trim().replace(/;?\s*$/, '') + ' RETURNING id';
      }
      
      const result = await pool.query(sql, params);
      
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
    // DON'T convert placeholders - let the caller use $1, $2, etc. directly for Postgres
    // OR ? for SQLite compatibility which we'll convert here
    let pgSql = sql;
    let paramCount = 0;
    
    // Only convert if using ? placeholders (SQLite style)
    if (sql.includes('?') && !sql.includes('$')) {
      pgSql = sql.replace(/\?/g, () => `$${++paramCount}`);
    }
    
    // Convert SQLite functions to Postgres
    pgSql = pgSql
      .replace(/datetime\('now'\)/gi, 'NOW()')
      .replace(/date\('now'/gi, "CURRENT_DATE")
      .replace(/\|\|/g, ' || ')  // Keep concatenation as-is
      .replace(/SUBSTR\(/gi, 'SUBSTRING(');

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
