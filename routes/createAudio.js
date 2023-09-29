// routes/postText.js
const express = require("express");
const router = express.Router();
const pool = require("../text");
const axios = require("axios");
const s3 = require("../s3"); // Assuming you have your S3 client configuration in a separate file
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { Readable } = require("stream");
require("dotenv").config();

router.post("/createAudio", async (req, res) => {
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
      let fileName = `audio/public/audio_${Date.now()}.mp3`;
      if (!id) {
        fileName = `audio/public/audio_${Date.now()}.mp3`;
      } else {
        fileName = `audio/users/${id}/audio_${Date.now()}.mp3`;
      }
      // Calculate the content length of the audio data
      const contentLength = audioData.length;

      // Convert audioData to a readable stream
      const audioStream = new Readable();
      audioStream.push(audioData);
      audioStream.push(null);

      const params = {
        Bucket: process.env.CYCLIC_BUCKET_NAME, // Replace with your S3 bucket name
        Key: fileName,
        Body: audioStream,
        ContentType: "audio/mpeg",
        ContentLength: contentLength, // Set the content length
      };

      try {
        const uploadResponse = await s3.send(new PutObjectCommand(params));

        if (uploadResponse.$metadata.httpStatusCode === 200) {
          const audioUrl = `${fileName}`;

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

            res.json(audioData);
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

module.exports = router;
