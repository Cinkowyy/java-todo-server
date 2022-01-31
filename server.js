const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const config = require('./config');

let connection;

mysql.createConnection({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database
}).then((con) => {
    connection = con;
    console.log("Database connected");
}).catch(err => {
    console.log("Cac't connect to database");
});


const app = express();
app.use(bodyParser.json());

app.post('/login', async (req, res) => {

    try {

        if (!(req.body.login && req.body.password)) {
            return res.status(400).json({
                message: "Missing login or password"
            })
        }

        const login = req.body.login;
        const password = req.body.password;

        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

        let query = "SELECT * FROM users WHERE login=? AND password=? LIMIT 1";
        let result = await connection.execute(query, [login, hashedPassword]);

        if (result[0].length == 0) {
            return res.status(401).json({
                message: "Invalid login or password"
            })
        }

        const key = crypto.randomBytes(16).toString('hex');

        query = "INSERT INTO sessions(UserID, AuthKey) VALUES(?, ?)";

        const userID = result[0][0].ID;
        result = await connection.execute(query, [userID, key]);

        const authKey = {
            AuthKey: key
        }

        res.send(authKey);

    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            message: "Server error"
        })
    }

})

app.listen(3000);