import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Supabase (and most cloud Postgres) requires SSL.
// For local dev with plain Postgres, set DB_SSL=false in .env.
const sslConfig =
  process.env.DB_SSL === 'false'
    ? false
    : { rejectUnauthorized: false }; // Supabase uses self-signed certs on pooler

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  max: 5,                    // keep pool small — friendly for serverless / free tiers
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error', err.message);
});

export const query = (text, params) => pool.query(text, params);
