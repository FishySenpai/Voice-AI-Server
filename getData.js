const axios = require("axios");
const fs = require("fs");
const apiUrl =
  "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM"; // Replace <voice-id> with the actual voice ID
const xiApiKey = "2a0e3af64ea95b70b4c92f05411c03c5"; // Replace <xi-api-key> with your actual API key

const requestData = {
  text: "why are you gay",
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

axios
  .post(apiUrl, requestData, { headers, responseType: "arraybuffer" })
  .then((response) => {
    // Handle the API response here
    if (response.status === 200) {
      const audioData = response.data;
      fs.writeFileSync("output.mp3", audioData);
      console.log("Audio file saved as output.mp3");
    } else {
      console.error("API request failed with status:", response.status);
    }
  })
  .catch((error) => {
    // Handle any errors that occur during the API request
    console.error("API Error:", error);
  });
