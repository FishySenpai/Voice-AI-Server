const Pool = require("pg").Pool;
require("dotenv").config();
const pool = new Pool({
    user: "postgres",
    password: process.env.PASSWORD,
    host: "localhost",
    post: 5432,
    database: "voiceai"
});
module.exports = pool;
