const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

const query = (text, params) => pool.query(text, params);

const ping = async () => {
  const res = await pool.query('SELECT 1 as ok');
  return res.rows[0].ok === 1;
};

module.exports = { pool, query, ping };