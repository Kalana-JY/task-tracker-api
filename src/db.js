const { Pool } = require('pg');

// Connection pool reads config from environment variables.
// This is intentional: in Docker/Kubernetes, config comes from env vars,
// never hardcoded values. This is the 12-factor app pattern.

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

async function initDb() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            done BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
        );
    `);
}

module.exports = { pool, initDb };