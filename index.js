const express = require("express")
const app = express()
const cors = require("cors")
const pool = require('./text')
const fs = require("fs");
app.use(cors());
app.use(express.json());

app.post("/text", async (req, res)=>{
    {
        try{
            const {description} = req.body;
             const audioData = fs.readFileSync("output.mp3");
            const newText = await pool.query("INSERT INTO text (description, audio) VALUES($1, $2) RETURNING *", [description, audioData]);
            res.json(newText)
        } catch(err) {
            console.error(err.message)
        }
    }
})
app.get("/all", async (req, res) => {
  {
    try {
      const newText = await pool.query("SELECT * FROM text");
      res.json(newText.rows);
    } catch (err) {
      console.error(err.message);
    }
  }
});
app.delete("/delete/:id", async (req, res) => {
  {
    try {
        const { id } = req.params;
      const newText = await pool.query("DELETE FROM text WHERE text_id = $1", [id]);
      res.json("text was deleted");
    } catch (err) {
      console.error(err.message);
    }
  }
});

app.listen(5000, ()=>{
    console.log("test")
})