const express = require("express");
const router = express.Router();

module.exports = function (db) {
  router.get("/login", (req, res) => {
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
