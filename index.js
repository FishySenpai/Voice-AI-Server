const express = require("express");
const app = express();
const cors = require("cors");
const pool = require("./text");
const axios = require("axios");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const saltRounds = 10;
require("dotenv").config();
const fs = require("fs");
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    key: "userId",
    secret: "subscribe",
    resave: false,
    saveUninitialized: false,
    cookie: {
      expires: 60 * 60 * 60 * 24,
      domain: "localhost", // Verify this domain
      path: "/",
    },
  })
);

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

app.post("/register", async (req, res) => {
  try {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;

    // Assuming you have defined saltRounds somewhere earlier in your code
    bcrypt.hash(password, saltRounds, async (err, hash) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      try {
        const register = await pool.query(
          "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *",
          [name, email, hash] // Use the hashed password
        );
        res.json(register.rows[0]); // Assuming you want to return the inserted user
      } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(400).json({ error: "Bad Request" });
  }
});


app.get("/login", (req, res) => {
  if (req.session.user) {
    res.send({ loggedIn: true, user: req.session.user });
  } else {
    res.send({ loggedIn: false });
  }
});



app.post("/login", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length > 0) {
      const passwordMatch = await bcrypt.compare(
        password,
        result.rows[0].password
      );
      if (passwordMatch) {
        req.session.user = result.rows[0];
        console.log(req.session.user);
        res.send(req.session.user);
      } else {
        res.send({ message: "Wrong email/password combination!" });
      }
    } else {
      res.send({ message: "User doesn't exist" });
    }
  } catch (err) {
    console.error(err.message);
    res.send({ error: "Internal Server Error" });
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
      const newText = await pool.query("DELETE FROM text WHERE text_id = $1", [
        id,
      ]);
      res.json("text was deleted");
    } catch (err) {
      console.error(err.message);
    }
  }
});

app.listen(5000, () => {
  console.log("test");
});
