# REST API

How to run

- `npm install`
- `nodemon server.js`

## DATABASE

The databse is SqLite, i used DB Browser for SqLite for editing the database.

# Tables:

- **Users**
  - `id` (Primary Key)
  - `username`
  - `password`
  - `role`

- **Rooms**
  - `id` (Primary Key)
  - `name`
  - `user_id` (Foreign Key - references `Users.id`)
  - `status`

- **Messages**
  - `id` (Primary Key)
  - `room_id` (Foreign Key - references `Rooms.id`)
  - `sender_id` (Foreign Key - references `Users.id`)
  - `message`
  - `created_at`


and images can be specified like so:

![example image](example-image.jpg "An exemplary image")

Inline math equations go in like so: $\omega = d\phi / dt$. Display
math should get its own line and be put in in double-dollarsigns:

$$I = \int \rho R^{2} dV$$

And note that you can backslash-escape any punctuation characters
which you wish to be displayed literally, ex.: \`foo\`, \*bar\*, etc.
