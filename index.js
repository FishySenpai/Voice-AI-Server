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
const {
  S3,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { Readable } = require("stream");
const s3 = new S3({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
});

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
const isProduction = process.env.NODE_ENV === "production";
app.use(
  session({
    key: "userId",
    secret: "subscribe",
    resave: false,
    saveUninitialized: false,
    cookie: {
      expires: 60 * 60 * 60 * 24,
      domain: "localhost", // Set the appropriate domain
      path: "/",
      // Set secure to true when using HTTPS
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
    const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`; // Replace with your actual API endpoint
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

    if (response.status === 200) {
      const audioData = response.data;
      const fileName = `audio_${Date.now()}.mp3`;

      // Calculate the content length of the audio data
      const contentLength = audioData.length;

      // Convert audioData to a readable stream
      const audioStream = new Readable();
      audioStream.push(audioData);
      audioStream.push(null);

      const params = {
        Bucket: process.env.BUCKET, // Replace with your S3 bucket name
        Key: fileName,
        Body: audioStream,
        ContentType: "audio/mpeg",
        ContentLength: contentLength, // Set the content length
      };

      try {
        const uploadResponse = await s3.send(new PutObjectCommand(params));

        if (uploadResponse.$metadata.httpStatusCode === 200) {
          const audioUrl = `https://${process.env.BUCKET}.s3.amazonaws.com/${fileName}`;

          if (!id) {
            // No user, insert into the general text table
            const newText = await pool.query(
              "INSERT INTO text (description, audio) VALUES ($1, $2) RETURNING *",
              [description, audioUrl]
            );

            res.json(audioData);
          } else {
            // User exists, insert into the user-specific table
            const newUserAudio = await pool.query(
              `INSERT INTO user_audio (user_id, description, audio_path) VALUES ($1, $2, $3) RETURNING *`,
              [id, description, audioUrl]
            );

            res.json({ audioUrl });
          }
        } else {
          console.error("Error uploading audio to S3:", uploadResponse);
          res.status(500).json({ error: "Failed to save audio" });
        }
      } catch (err) {
        console.error("Error uploading audio to S3:", err);
        res.status(500).json({ error: "Failed to save audio" });
      }
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/all", async (req, res) => {
  try {
    // Query the database to retrieve audio file paths
    const result = await pool.query("SELECT * FROM text"); // Replace with your actual table name
    const streamToString = (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      });
    // Create an array to hold the audio data
    const audioFiles = [];

    // Iterate through the database results
    for (const row of result.rows) {
      const audioPath = row.audio; // Adjust this column name to match your schema
      console.log(audioPath);

      // Fetch the audio data from the S3 object
      const getObjectCommand = new GetObjectCommand({
        Bucket: process.env.BUCKET, // Replace with your S3 bucket name
        Key: "audio_1694840349671.mp3", // Assuming audioPath contains the S3 object key
      });

      const { Body } = await s3.send(getObjectCommand);
      // You can process the audio data here as needed
      // For example, you can convert it to base64 or store it in an array
      const audioData = await streamToString(Body);
      console.log(audioData);
      audioFiles.push({
        text_id: row.text_id,
        description: row.description, // Add any other relevant data you want to include
        audioData: audioData,
      });
    }

    // Send the array of audio files as a JSON response to the frontend
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
    const result = await pool.query(
      "SELECT * FROM user_audio where user_id = $1",
      [id]
    );

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
      console.log(newText);
      res.json("file deleted was deleted");
    } catch (err) {
      console.error(err.message);
    }
  }
});

app.listen(5000, () => {
  console.log("test");
});
