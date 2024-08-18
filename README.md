# REST API for User Support


 **Install dependencies**:
   ```bash
    npm install
    nodemon server.js
   ```

## Database

The databse is SqLite, i used DB Browser for SqLite for editing the database.

### Tables:

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


## Authentication

The API uses Basic HTTP Authentication. 
For accessing the endpoints you need to provide username and password.

## Testing

Most of the testing was done by using Postman.

I have also included the `kaldiFinal.postman_collection.json` that should upon being imported into Postman show the requests.