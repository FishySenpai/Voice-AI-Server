const express = require("express");
const app = express();
const cors = require("cors");
const pool = require("./text");
const axios = require("axios");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("cookie-session");
const deletePublicAudio = require("./routes/deletePublicAudio");
const deleteUserAudio = require("./routes/deleteUserAudio");
const getAllPublic = require("./routes/getAllPublic");
const getAllUserAudio = require("./routes/getAllUserAudio")
const createAudio = require("./routes/createAudio");
const saltRounds = 10;
require("dotenv").config();

app.use(express.json());
app.use(
  cors({
    origin: ["https://voice-ai-clone.netlify.app", "http://localhost:5173"],
    methods: ["GET", "POST", "DELETE"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

//allowing proxy allowed setcookie header to be sent
app.set("trust proxy", 1);

// Warning: connect.session() MemoryStore is not designed for a production environment, as it will leak memory, and will not scale past a single process.
// have to use redis or smth similar when using express session outside local einvironment to store sessions and validate them
app.use(
  session({
    name: "session", // Name for the cookie
    keys: [process.env.secret], // Array of keys to sign cookies
    maxAge: 60 * 60 * 60 * 24 * 1000, // Cookie expiration time in milliseconds
    domain: process.env.NODE_ENV === "production" ? ".cyclic.app" : "localhost",
    path: "/",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    secure: process.env.NODE_ENV === "production" ? true : false,
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
        // Set a cookie to establish the session
        req.session.user = result.rows[0];
        
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

app.use("/delete", deletePublicAudio);
app.use(createAudio);
app.use(deleteUserAudio);
app.use(getAllPublic);
app.use(getAllUserAudio)
app.listen(5000, () => {
  console.log("test");
});
