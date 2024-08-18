const express = require("express");
const router = express.Router();

// Middleware for Basic Authentication with database integration
function basicAuth(db) {
  return (req, res, next) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ error: "No credentials sent!" });
    }

    const [scheme, credentials] = authHeader.split(" ");
    if (scheme !== "Basic" || !credentials) {
      return res.status(401).json({ error: "Invalid authentication scheme!" });
    }

    const [username, password] = Buffer.from(credentials, "base64")
      .toString()
      .split(":");

    // Check credentials against the database
    const checkUser =
      "SELECT Username FROM Users WHERE Username = ? AND Password = ?";

    db.get(checkUser, [username, password], (err, user) => {
      if (err) {
        console.error("Error executing query " + err.message);
        return res.status(500).json({ error: "Internal server error!" });
      }
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials!" });
      }

      next();
    });
  };
}

module.exports = function (db) {
  // Route to handle login
  router.post("/login", (req, res) => {
    const { username, password } = req.body;

    const checkUser =
      "SELECT Username, Password, id FROM Users WHERE Username = ? AND Password = ?";

    db.get(checkUser, [username, password], (err, user) => {
      if (err) {
        console.error("Error executing query " + err.message);
        return res.status(500).json({ error: "Internal server error!" });
      }
      if (!user) {
        return res
          .status(401)
          .json({ error: "Invalid username and or password!" });
      }

      res.json({ message: "Login successful!", id: user.id });
    });
  });

  return router;
};
