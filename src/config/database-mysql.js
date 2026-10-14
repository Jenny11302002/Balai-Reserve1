/**
 * MySQL Database Adapter
 * Supports both individual env vars (MYSQL_HOST etc.) and DATABASE_URL
 */
'use strict';

const mysql = require('mysql2/promise');

// Support DATABASE_URL (mysql://user:pass@host:port/dbname) or individual vars
let poolConfig;

if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql')) {
  poolConfig = { uri: process.env.DATABASE_URL };
} else {
  if (!process.env.MYSQL_HOST) {
    throw new Error('MySQL config missing. Set MYSQL_HOST or DATABASE_URL');
  }
  poolConfig = {
    host:     process.env.MYSQL_HOST,
    user:     process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port:     parseInt(process.env.MYSQL_PORT || '3306'),
  };
}

const pool = mysql.createPool({
  ...poolConfig,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
});

console.log('MySQL pool created');

class Statement {
  constructor(sql) {
    this.sql = sql;
  }

  async get(...params) {
    const args = params.flat();
    try {
      const [rows] = await pool.execute(this.sql, args);
      return rows[0];
    } catch (err) {
      console.error('MySQL get error:', err.message, '| SQL:', this.sql);
      throw err;
    }
  }

  async all(...params) {
    const args = params.flat();
    try {
      const [rows] = await pool.execute(this.sql, args);
      return rows;
    } catch (err) {
      console.error('MySQL all error:', err.message, '| SQL:', this.sql);
      throw err;
    }
  }

  async run(...params) {
    const args = params.flat();
    try {
      const [result] = await pool.execute(this.sql, args);
      return { changes: result.affectedRows, lastInsertRowid: result.insertId || null };
    } catch (err) {
      console.error('MySQL run error:', err.message, '| SQL:', this.sql);
      throw err;
    }
  }
}

const database = {
  prepare(sql) { return new Statement(sql); },
  async query(sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows;
  },
  pragma() { return this; },
  async close() { await pool.end(); },
  getPool() { return pool; },
};

process.on('SIGINT',  async () => { await pool.end(); process.exit(0); });
process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });

module.exports = database;