const express = require("express")
const app = express()
const cors = require("cors")
const pool = require('./db')

app.use(cors());
app.use(express.json());

app.post("/text", async (req, res)=>{
    {
        try{
            const {description} = req.body;
            const newText = await pool.query("INSERT INTO text (description) VALUES($1) RETURNING *", [description]);
            res.json(newText)
        } catch(err) {
            console.error(err.message)
        }
    }
})

app.listen(5000, ()=>{
    console.log("test")
})