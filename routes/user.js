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
  router.post(
    "/createRoomAndSendMessage",
    basicAuth(db, "user"),
    (req, res) => {
      const { roomName, message } = req.body;

      if (!roomName) {
        return res.status(400).json({ error: "Please select a room!" });
      }

      if (message === "") {
        return res.status(400).json({ error: "Message cannot be empty!" });
      }

      // Start the transaction
      db.serialize(() => {
        db.run("BEGIN TRANSACTION", (err) => {
          if (err) {
            console.error("Error starting transaction: " + err.message);
            return res.status(500).json({ error: "Internal Server Error 1" });
          }

          // Insert a new room with the provided name
          const insertRoom = db.prepare(`
            INSERT INTO Rooms (name, user_id, status)
            VALUES (?, ?, 'open')
          `);

          insertRoom.run(roomName, req.user.id, function (err) {
            if (err) {
              console.error("Error inserting room: " + err.message);
              return db.run("ROLLBACK", () => {
                res.status(500).json({ error: "Internal Server Error 2" });
              });
            }

            const roomId = this.lastID; // Get the newly inserted room ID

            // Insert the initial message with provided content
            const insertMessage = db.prepare(`
              INSERT INTO Messages (room_id, sender_id, message)
              VALUES (?, ?, ?)
            `);

            insertMessage.run(roomId, req.user.id, message, function (err) {
              if (err) {
                console.error("Error inserting message: " + err.message);
                return db.run("ROLLBACK", () => {
                  res.status(500).json({ error: "Internal Server Error 3" });
                });
              }

              // Commit the transaction
              db.run("COMMIT", (err) => {
                if (err) {
                  console.error("Error committing transaction: " + err.message);
                  return db.run("ROLLBACK", () => {
                    res.status(500).json({ error: "Internal Server Error 4" });
                  });
                }

                res.status(201).json({
                  message: "Room and message created successfully",
                  roomId,
                });
              });
            });

            insertMessage.finalize();
          });

          insertRoom.finalize();
        });
      });
    }
  );

  router.get("/showAllUsersRooms", basicAuth(db, "user"), (req, res) => {
    const sql = `
    SELECT 
    Rooms.id AS room_id,
    Rooms.name AS room_name,
    Messages.message AS message_content,
    MessageSender.username AS sender_username
    FROM Rooms
    LEFT JOIN Messages ON Rooms.id = Messages.room_id
    LEFT JOIN Users AS MessageSender ON Messages.sender_id = MessageSender.id
    WHERE Rooms.user_id = ?;`;

    db.all(sql, [req.user.id], (err, rows) => {
      if (err) {
        console.error("Error executing query " + err.message);
        return res.status(500).json({ error: "Internal server error!" });
      }

      res.json(rows);
    });
  });

  router.get("/sendMessageToRoom", basicAuth(db, "user"), (req, res) => {
    const { message, roomId } = req.body;
    const sql = `
    INSERT INTO Messages (room_id, sender_id, message)
    VALUES (?, ?, ?);;`;

    db.all(sql, [roomId, req.user.id, message], (err, rows) => {
      if (err) {
        console.error("Error executing query " + err.message);
        return res.status(500).json({ error: "Internal server error!" });
      }

      // res.json(rows);
      res.json("Message sent!");
    });
  });

  router.get("/showCertainRoom", basicAuth(db, "user"), (req, res) => {
    const { roomId } = req.body;
    const sql = `
    SELECT 
	  Messages.room_id, 
	  Users.username,
	  Messages.message
    FROM Messages
    JOIN Users ON Messages.sender_id = Users.id
    WHERE Messages.room_id = ?;`;

    db.all(sql, [roomId], (err, rows) => {
      if (err) {
        console.error("Error executing query " + err.message);
        return res.status(500).json({ error: "Internal server error!" });
      }

      res.json(rows);
    });
  });

  return router;
};
