// routes/deleteUser.js
const express = require("express");
const pool = require("../text"); // Import your database connection
const router = express.Router();

router.delete("/user/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM user_audio WHERE id = $1", [
      id,
    ]);
    console.log(result);
    res.json("File was deleted");
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
