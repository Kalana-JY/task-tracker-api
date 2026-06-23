const { Pool } = require('pg');

// Connection pool reads config from environment variables.
// This is intentional: in Docker/Kubernetes, config comes from env vars,
// never hardcoded values. This is the 12-factor app pattern.

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'taskdb'
});

async function initDb() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

// Simple health check
pool.on('connect', () => {
    console.log('✅ Database connected');
});

module.exports = { pool, initDb};