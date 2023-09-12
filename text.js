const fs = require("fs");
const { Pool } = require("pg");
const url = require("url");
require("dotenv").config();

const postgresqlUri = process.env.postgresqlUri;

const conn = new URL(postgresqlUri);
conn.search = "";

const pool = new Pool({
  connectionString: conn.href,
  ssl: {
    rejectUnauthorized: false,
    ca: process.env.ca,
  },
});

// Export the pool so you can use it in other parts of your application
module.exports = pool;

// You don't need the client connection code here anymore
// The connection pool will manage connections for you
