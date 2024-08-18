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
          error: `Access denied! Only users with the role of '${role}' can access.`,
        });
      }

      next();
    });
  };
}

module.exports = function (db) {
  // Route to show all conversations
  router.get("/showAllRooms", basicAuth(db, "operator"), (req, res) => {
    const showOpenConversations = `
SELECT 
    Rooms.id AS room_id,
    Rooms.name AS room_name,
    GROUP_CONCAT(
        Messages.message || ' (Sent by: ' || Users.username || ')',
        ' | '
    ) AS messages,
    Rooms.status AS status
FROM Rooms
LEFT JOIN Messages ON Rooms.id = Messages.room_id
LEFT JOIN Users ON Messages.sender_id = Users.id
GROUP BY Rooms.id, Rooms.name, Rooms.status;
        `;

    db.all(showOpenConversations, [], (err, rows) => {
      if (err) {
        console.error("Error executing query: " + err.message);
        return res.status(500).json({ error: "Internal server error!" });
      }
      res.json(rows);
    });
  });

  router.get(
    "/showTakenConversations",
    basicAuth(db, "operator"),
    (req, res) => {
      const showTakenConversations = `
        SELECT Messages.conversation_id, Messages.sender_id, Messages.message, Conversations.status
        FROM Messages
        JOIN Conversations ON Messages.conversation_id = Conversations.id
        WHERE Conversations.status = 'taken'
        `;

      db.all(showTakenConversations, [], (err, rows) => {
        if (err) {
          console.error("Error executing query: " + err.message);
          return res.status(500).json({ error: "Internal server error!" });
        }
        res.json(rows);
      });
    }
  );

  router.post("/takeRoom", basicAuth(db, "operator"), (req, res) => {
    // Get conversation_id from the request body
    const { conversation_id } = req.body;

    // SQL query to update the conversation status
    const closeRoom = `
        UPDATE Conversations
        SET status = 'taken'
        WHERE id IN (
        SELECT Conversations.id
        FROM Conversations
        JOIN Messages ON Messages.conversation_id = Conversations.id
        WHERE Conversations.status = 'open' AND Messages.conversation_id = ?
        )`;

    // Run the update query
    db.run(closeRoom, [conversation_id], function (err) {
      if (err) {
        console.error("Error executing query: " + err.message);
        return res.status(500).json({ error: "Internal server error!" });
      }

      // Check if any rows were updated
      if (this.changes === 0) {
        return res.status(401).json({ error: "You cannot take this room!" });
      }

      // If successful, return a success message
      res.json({ message: "Room successfully taken!", conversation_id });
    });
  });

  router.post("/sendMessage", basicAuth(db, "operator"), (req, res) => {
    const { message, conversation_id } = req.body;
    const writeAnswer = `
          INSERT INTO Messages (conversation_id, sender_id, message)
          VALUES (?, ?, ?)
        `;

    if (!message || message === "") {
      return res.status(400).json({ error: "Message cannot be empty!" });
    }

    db.run(
      writeAnswer,
      [conversation_id, req.user.id, message],
      function (err) {
        if (err) {
          console.error("Error executing query: " + err.message);
          return res.status(500).json({ error: "Internal server error!" });
        }

        if (this.changes === 0) {
          return res.status(401).json({ error: "Cannot insert!" });
        }

        res.json({ message: "Message successfully answered!" });
      }
    );
  });

  return router;
};
