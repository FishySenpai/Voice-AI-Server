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
    methods: ["GET", "POST", "DELETE"],
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
      domain: ".cyclic.app", // Verify this domain
      path: "/",
      sameSite: "None",
    },
  })
);

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
    res.send({
      loggedIn: true,
      id: req.session.user.id,
      name: req.session.user.name,
    });
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

app.post("/text", async (req, res) => {
  console.log(req.session.user);
  try {
    const { description, id, voiceId } = req.body;

    // Make a request to the external API to generate audio
    const apiUrl =
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`; // Replace with your actual API endpoint
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
      const fileName = `audio_${Date.now()}.mp3`;
      

;
      if (!id) {
        // No user, insert into the general text table
        const publicFilePath = `audio/public/${fileName}`;
        fs.writeFile(publicFilePath, audioData, "binary", async (err) => {
          if (err) {
            console.error("Error saving audio file:", err);
            res.status(500).json({ error: "Failed to save audio" });
          } else {
            const newText = await pool.query(
              "INSERT INTO text (description, audio) VALUES ($1, $2) RETURNING *",
              [description, publicFilePath]
            );

            res.json(audioData);
          }
        });
      } else {
        const path = `audio/users/${id}`;

        if (!fs.existsSync(path)) {
          fs.mkdirSync(path, { recursive: true });
        }
        // User exists, insert into the user-specific table
        const userFilePath = `audio/users/${id}/${fileName}`;

        fs.writeFile(userFilePath, audioData, "binary", async (err) => {
          if (err) {
            console.error("Error saving audio file:", err);
            res.status(500).json({ error: "Failed to save audio" });
          } else {
            const newUserAudio = await pool.query(
              `INSERT INTO user_audio (user_id, description, audio_path) VALUES ($1, $2, $3) RETURNING *`,
              [id, description, userFilePath]
            );

            res.json(newUserAudio);
          }
        });
      }
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/all", async (req, res) => {
  try {
    // Query the database to retrieve the audio file paths
    const result = await pool.query("SELECT * FROM text");

    // Prepare an array to hold the audio file data
    const audioFiles = [];

    // Iterate through the database results
    for (const row of result.rows) {
      const audioPath = row.audio; // Adjust this column name to match your schema

      // Read the audio file from the server
      const audioData = fs.readFileSync(audioPath);

      audioFiles.push({
        text_id: row.text_id,
        description: row.description, // Add any other relevant data you want to include
        audioData: audioData, // Convert audio data to base64 for sending
      });
    }

    // Send the array of audio files as JSON response
    res.json(audioFiles);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/user/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Query the database to retrieve the audio file paths
    const result = await pool.query("SELECT * FROM user_audio where user_id = $1", [id]);

    // Prepare an array to hold the audio file data
    const audioFiles = [];

    // Iterate through the database results
    for (const row of result.rows) {
      const audioPath = row.audio_path; // Adjust this column name to match your schema

      // Read the audio file from the server
      const audioData = fs.readFileSync(audioPath);

      audioFiles.push({
        id: row.id,
        description: row.description, // Add any other relevant data you want to include
        audioData: audioData, // Convert audio data to base64 for sending
      });
    }

    // Send the array of audio files as JSON response
    res.json(audioFiles);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Internal server error" });
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
app.delete("/user/delete/:id", async (req, res) => {
  {
    try {
      const { id } = req.params;
      const newText = await pool.query("DELETE FROM user_audio WHERE id = $1", [
        id,
      ]);
      console.log(newText)
      res.json("file deleted was deleted");
    } catch (err) {
      console.error(err.message);
    }
  }
});

app.listen(5000, () => {
  console.log("test");
});
