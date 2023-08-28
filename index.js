const express = require("express")
const app = express()
const cors = require("cors")
const pool = require('./text')
const axios = require("axios");
require("dotenv").config();
const fs = require("fs");
app.use(cors());
app.use(express.json());

app.post("/text", async (req, res) => {
  try {
    const { description } = req.body;

    // Make a request to the external API to generate audio
    const apiUrl =
      "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM"; // Replace with your actual API endpoint
    const xiApiKey = process.env.xiApiKey; // Replace with your actual API key

    const requestData = {
      text: description, // Use the text from the request body
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    };

    const headers = {
      accept: "audio/mpeg",
      "xi-api-key": xiApiKey,
      "Content-Type": "application/json",
    };

    const response = await axios.post(apiUrl, requestData, {
      headers,
      responseType: "arraybuffer",
    });

    // Handle the API response here
    if (response.status === 200) {
      const audioData = response.data;

      // Insert both the text and audio data into the database
      const newText = await pool.query(
        "INSERT INTO text (description, audio) VALUES ($1, $2) RETURNING *",
        [description, audioData]
      );

      res.json(newText);
    } else {
      console.error("API request failed with status:", response.status);
      res.status(500).json({ error: "Failed to generate audio" });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

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