const express = require("express");
const router = express.Router();

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

      req.user = user;

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
  router.get("/showAllRooms", basicAuth(db, "operator"), (req, res) => {
    const showOpenConversations = `
SELECT 
    Rooms.id AS room_id,
    Rooms.name AS room_name,
    GROUP_CONCAT(
         Users.username || ': ' || Messages.message || ' '
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
        SELECT 
        Rooms.id AS room_id,
        Rooms.name AS room_name,
        GROUP_CONCAT(
            Users.username || ': ' || Messages.message,
            ', '
        ) AS messages,
        Rooms.status AS status
        FROM Rooms
        LEFT JOIN Messages ON Rooms.id = Messages.room_id
        LEFT JOIN Users ON Messages.sender_id = Users.id
        WHERE Rooms.status = 'taken'
        GROUP BY Rooms.id, Rooms.name, Rooms.status;

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
    const { roomId } = req.body;

    const checkRoomStatus = `
        SELECT status
        FROM Rooms
        WHERE id = ?;
    `;

    db.get(checkRoomStatus, [roomId], (err, row) => {
      if (err) {
        console.error("Error executing query: " + err.message);
        return res.status(500).json({ error: "Internal server error!" });
      }

      if (!row) {
        return res.status(404).json({ error: "Room not found!" });
      }

      if (row.status === "taken") {
        return res.status(400).json({ error: "Room is already taken!" });
      }

      const closeRoom = `
            UPDATE Rooms
            SET status = 'taken'
            WHERE id = ?;
        `;

      db.run(closeRoom, [roomId], function (err) {
        if (err) {
          console.error("Error executing query: " + err.message);
          return res.status(500).json({ error: "Internal server error!" });
        }

        if (this.changes === 0) {
          return res.status(401).json({ error: "You cannot take this room!" });
        }

        res.json({ message: "Room successfully taken!", roomId });
      });
    });
  });

  router.post("/sendMessage", basicAuth(db, "operator"), (req, res) => {
    const { message, roomId } = req.body;
    const writeAnswer = `
        INSERT INTO Messages (room_id, sender_id, message)
        VALUES (?, ?, ?)
        `;

    if (!message || message === "") {
      return res.status(400).json({ error: "Message cannot be empty!" });
    }

    db.run(writeAnswer, [roomId, req.user.id, message], function (err) {
      if (err) {
        console.error("Error executing query: " + err.message);
        return res.status(500).json({ error: "Internal server error!" });
      }

      if (this.changes === 0) {
        return res.status(401).json({ error: "Cannot insert!" });
      }

      res.json({ message: "Message successfully sent!" });
    });
  });

  router.get("/showCertainRoom", basicAuth(db, "operator"), (req, res) => {
    const { roomId } = req.body;
    const writeAnswer = `
       SELECT 
	    Messages.room_id, 
	    Users.username,
	    Messages.message
      FROM Messages
      JOIN Users ON Messages.sender_id = Users.id
      WHERE Messages.room_id = ?;
        `;

    if (!roomId || roomId === "") {
      return res.status(400).json({ error: "Wrong roomId!" });
    }

    db.all(writeAnswer, [roomId], (err, rows) => {
      if (err) {
        console.error("Error executing query: " + err.message);
        return res.status(500).json({ error: "Internal server error!" });
      }

      if (this.changes === 0) {
        return res.status(401).json({ error: "Cannot get room!" });
      }

      res.json(rows);
    });
  });

  return router;
};
