const express = require("express");
const router = express.Router();

// Middleware for Basic Authentication with role check
function basicAuth(db, role) {
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
      "SELECT id, role FROM Users WHERE username = ? AND password = ?";

    db.get(checkUser, [username, password], (err, user) => {
      if (err) {
        console.error("Error executing query: " + err.message);
        return res.status(500).json({ error: "Internal server error!" });
      }
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials!" });
      }

      // Attach user data to the request object
      req.user = user;

      // Role check
      if (role && req.user.role !== role) {
        return res.status(403).json({
          error: `Access denied. Only users with the role of '${role}' can access this endpoint.`,
        });
      }

      next();
    });
  };
}

module.exports = function (db) {
  // Route to create a conversation and insert an initial message
  router.post("/sendMessage", basicAuth(db, "user"), (req, res) => {
    const { roomName, message } = req.body;

    if (!roomName) {
      return res.status(400).json({ error: "Please select a room!" });
    }

    if (message === "") {
      return res.status(400).json({ error: "Message cannot be empty!" });
    }

    // Start the transaction
    db.run("BEGIN TRANSACTION", (err) => {
      if (err) {
        console.error("Error starting transaction: " + err.message);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      // Insert a new conversation
      const insertConversation = db.prepare(`
        INSERT INTO Conversations (user_id, room_id, status)
        VALUES (
          ?,
          (SELECT id FROM Rooms WHERE name = ?),
          ?
        )
      `);

      insertConversation.run(req.user.id, roomName, "open", function (err) {
        if (err) {
          console.error("Error inserting conversation: " + err.message);
          return db.run("ROLLBACK", () => {
            res.status(500).json({ error: "Internal Server Error" });
          });
        }

        const conversationId = this.lastID;

        // Insert the initial message with provided content
        const insertMessage = db.prepare(`
          INSERT INTO Messages (conversation_id, sender_id, message)
          VALUES (
            ?,
            ?,
            ?
          )
        `);

        insertMessage.run(
          conversationId,
          req.user.id,
          message || "",
          function (err) {
            if (err) {
              console.error("Error inserting message: " + err.message);
              return db.run("ROLLBACK", () => {
                res.status(500).json({ error: "Internal Server Error" });
              });
            }

            // Commit the transaction
            db.run("COMMIT", (err) => {
              if (err) {
                console.error("Error committing transaction: " + err.message);
                return db.run("ROLLBACK", () => {
                  res.status(500).json({ error: "Internal Server Error" });
                });
              }

              res.status(201).json({
                message: "Conversation and message created successfully",
              });
            });
          }
        );

        insertMessage.finalize();
      });

      insertConversation.finalize();
    });
  });

  router.get("/showAllUsersRooms", basicAuth(db, "user"), (req, res) => {
    const sql = `
    SELECT Messages.conversation_id, Messages.message, Messages.created_at
    FROM Messages
    WHERE Messages.sender_id = ?`;

    db.all(sql, [req.user.id], (err, rows) => {
      if (err) {
        console.error("Error executing query " + err.message);
        return res.status(500).json({ error: "Internal server error!" });
      }

      res.json(rows);
    });
  });

  return router;
};
