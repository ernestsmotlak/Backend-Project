const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
const port = 4001;

// Middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello, you are authenticated!");
});

// Open a database connection
const db = new sqlite3.Database("./Database.db", (err) => {
  if (err) {
    console.error("Error opening database " + err.message);
  } else {
    console.log("Connected to the SQLite database.");
  }
});

// Import routes and pass the database connection
const login = require("./routes/login")(db);
app.use("/auth", login);

const user = require("./routes/user")(db);
app.use("/users", user);

const operator = require("./routes/operator")(db);
app.use("/operator", operator);

// Handle server shutdown gracefully
process.on("SIGINT", () => {
  db.close((err) => {
    if (err) {
      console.error("Error closing database " + err.message);
    }
    console.log("Database connection closed.");
    process.exit(0);
  });
});

// Start the server
app
  .listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  })
  .on("error", (err) => {
    console.error("Failed to start server:", err);
  });
