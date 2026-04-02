// =============================================================================
// connection.js — Database Connection Pool
// =============================================================================
//
// WHY A POOL? Opening a new database connection for every request is slow
// (~50-100ms each time). A pool keeps several connections open and ready,
// so when a route needs the database, it "borrows" a connection from the pool,
// uses it, and returns it. This is much faster (~1ms).
//
// Think of it like a car rental desk at an airport: instead of buying a new
// car every time a customer arrives, you keep a fleet ready to go.
//
// We use mysql2/promise which gives us async/await support:
//   const [rows] = await pool.query('SELECT ...', [params]);
//
// IMPORTANT: Import this file everywhere you need the database.
// Never create a second pool — that would defeat the purpose.
// =============================================================================

import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',      // database server address
  port: parseInt(process.env.DB_PORT || '3306'),  // MariaDB default port
  user: process.env.DB_USER || 'digital_family',  // database username
  password: process.env.DB_PASSWORD || '',         // from .env file (never hardcode!)
  database: process.env.DB_NAME || 'digital_family',

  // Pool configuration:
  waitForConnections: true,  // if all connections are in use, wait instead of failing
  connectionLimit: 10,       // max 10 simultaneous connections (enough for a family app)
  queueLimit: 0              // unlimited queue (0 = no limit on waiting requests)
});

export default pool;
