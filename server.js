const express = require('express');
const path = require('path');
const http = require('http');
const socketio = require('socket.io');
const formatMessage = require('./utils/chatMessage');
const mongoClient = require('mongodb').MongoClient;

const dbname = process.env.DB_NAME;
const chatCollection = 'chats';
const userCollection = 'onlineUsers';

const port = 5000;
const mongoHost = process.env.MONGO_HOST || 'localhost';
const mongoPort = process.env.MONGO_PORT || '27017';
const database = `mongodb://${mongoHost}:${mongoPort}/`;

const app = express();
const server = http.createServer(app);
const io = socketio(server);

io.on('connection', (socket) => {
    console.log('New User Logged In with ID ' + socket.id);

    // Collect message and insert into database
    socket.on('chatMessage', (data) => {
        const dataElement = formatMessage(data);
        mongoClient.connect(database, (err, db) => {
            if (err) throw err;
            else {
                const onlineUsers = db.db(dbname).collection(userCollection);
                const chat = db.db(dbname).collection(chatCollection);

                chat.insertOne(dataElement, (err, res) => {
                    if (err) throw err;
                    socket.emit('message', dataElement);
                });

                onlineUsers.findOne({ name: data.toUser }, (err, res) => {
                    if (err) throw err;
                    if (res != null) {
                        socket.to(res.ID).emit('message', dataElement);
                    }
                });
            }
            db.close();
        });
    });

    // Handle user login and chat history request
    socket.on('userDetails', (data) => {
        mongoClient.connect(database, (err, db) => {
            if (err) throw err;
            else {
                const onlineUser = {
                    ID: socket.id,
                    name: data.fromUser
                };

                const currentCollection = db.db(dbname).collection(chatCollection);
                const online = db.db(dbname).collection(userCollection);

                online.insertOne(onlineUser, (err, res) => {
                    if (err) throw err;
                    console.log(onlineUser.name + " is online...");
                });

                currentCollection.find({
                    from: { $in: [data.fromUser, data.toUser] },
                    to: { $in: [data.fromUser, data.toUser] }
                }, { projection: { _id: 0 } }).toArray((err, res) => {
                    if (err) throw err;
                    else {
                        socket.emit('output', res);
                    }
                });
            }
            db.close();
        });
    });

    // Handle user disconnect
    const userID = socket.id;
    socket.on('disconnect', () => {
        mongoClient.connect(database, (err, db) => {
            if (err) throw err;
            const onlineUsers = db.db(dbname).collection(userCollection);
            const myquery = { ID: userID };
            onlineUsers.deleteOne(myquery, (err, res) => {
                if (err) throw err;
                console.log("User " + userID + " went offline...");
                db.close();
            });
        });
    });
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'front')));

// Start server
server.listen(port, () => {
    console.log(`Chat Server listening on port ${port}...`);
});
