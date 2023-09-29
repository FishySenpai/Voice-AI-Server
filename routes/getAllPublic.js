// routes/getAll.js
const express = require("express");
const router = express.Router();
const pool = require("../text");
const s3 = require("../s3"); // Assuming you have your S3 client configuration in a separate file
const { GetObjectCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();

router.get("/all", async (req, res) => {
  try {
    // Query the database to retrieve audio file paths
    const result = await pool.query("SELECT * FROM text");
    //converting it into bufferarray cuz binary was causing issues with conversion to audio
    const streamToBufferArray = (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
      });
    // Create an array to hold the audio data
    const audioFiles = [];

    // Iterate through the database results
    for (const row of result.rows) {
      const audioPath = row.audio; // Adjust this column name to match your schema
      console.log(audioPath);

      // Fetch the audio data from the S3 object
      const getObjectCommand = new GetObjectCommand({
        Bucket: process.env.CYCLIC_BUCKET_NAME, // Replace with your S3 bucket name
        Key: audioPath, // Assuming audioPath contains the S3 object key
      });

      const { Body } = await s3.send(getObjectCommand);
      // You can process the audio data here as needed
      // For example, you can convert it to base64 or store it in an array
      const audioData = await streamToBufferArray(Body);

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

module.exports = router;
