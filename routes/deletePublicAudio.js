// routes/delete.js
const express = require("express");
const router = express.Router();
const pool = require("../text"); // Assuming your database connection is in a 'db.js' file.

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const newText = await pool.query("DELETE FROM text WHERE text_id = $1", [
      id,
    ]);
    res.json("Text was deleted");
  } catch (err) {
    console.error(err.message);
  }
});

module.exports = router;
