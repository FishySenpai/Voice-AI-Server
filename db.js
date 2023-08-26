const Pool = require("pg").Pool;
require("dotenv").config();
const pool = new Pool({
  user: "avnadmin",
  password: "",
  host: "voice-ai-voice-ai.aivencloud.com",
  post: 27157,
  database: "voiceai",
});
module.exports = pool;
