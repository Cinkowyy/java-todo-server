const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const config = require('./config');
const { isSet } = require('util/types');

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


function authorization(req, res, next) {

    if(!req.get("Authorization")) {
        return res.status(401).json({
            message: "Missing authentication key"
        })
    }

    return next();
}


const app = express();
app.use(bodyParser.json());


app.post('/clear',[authorization], async (req, res) => {

    const userKey = req.get("Authorization");
    
    try {

        let deleteRes = await connection.execute("DELETE FROM todos WHERE status=1 AND user_id IN (SELECT user_id FROM sessions WHERE auth_key = ?)", [userKey]);

        if(deleteRes[0].affectedRows < 1) {
            res.status(400).json( {
                message: "No todos to delete"
             });
        } else {
            res.json({
                message: "Completed todos has been cleared"
            })
        }
        
    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            message: "Server error"
        })
    }
})


app.post('/delete',[authorization], async (req, res) => {
    
    try {

        if(!req.body.id) {
            return res.status(400).json({
                message: "Missing variables"
            })
        }

        const todoId = req.body.id;


        let deleteRes = await connection.execute("DELETE FROM todos where id = ?", [todoId]);
        
        if(deleteRes[0].affectedRows < 1) {
            res.status(400).json( {
                message: "Deleting error"
             });
            
        } else {
            res.json( {
                message: "Todo has been deleted"
             });
        }
        
    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            message: "Server error"
        })
    }
})

app.post('/add',[authorization], async (req, res) => {

    try {

        if(isSet(req.body.id) || !req.body.content || isSet(req.body.status)) {
            return res.status(400).json({
                message: "Missing variables"
            })
        }

        const newTodoAuthKey = req.get("Authorization");
        const newTodoContent = req.body.content;
        const newTodoStatus = false;
        let newTodoUserId = await connection.execute("SELECT user_id FROM sessions WHERE auth_key = ?", [newTodoAuthKey])
        newTodoUserId = newTodoUserId[0][0].user_id;

        let result = await connection.execute("INSERT INTO todos (user_id, content, status) VALUES (?,?,?)", [newTodoUserId, newTodoContent, newTodoStatus]);

        const newTodoId = result[0].insertId;

        res.json({
            id: newTodoId,
            content: newTodoContent,
            status: newTodoStatus
        })


        
    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            message: "Server error"
        })
    }
})


app.post('/update',[authorization], async (req,res) => {
    try {

        if (!req.body.id || isSet(req.body.status)) {
            return res.status(400).json({
                message: "Missing variables"
            })
        }

        const id = req.body.id;
        const newStatus = req.body.status;

        let updateResult = await connection.execute("UPDATE todos SET status = ? WHERE id=?", [newStatus, id]);

        if(updateResult[0].affectedRows == 1) {
            res.json( {
                message: "Status has been updated"
             });
        } else {
            res.status(400).json( {
                message: "Updating status error"
             });
        }
         

    } catch(err) {
        console.error(err.message);
        res.status(500).json({
            message: "Server error"
        })
    }
})

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

        let result = await connection.execute("SELECT * FROM users WHERE login=? AND password=? LIMIT 1", [login, hashedPassword]);

        if (result[0].length == 0) {
            return res.status(401).json({
                message: "Invalid login or password"
            })
        }

        const key = crypto.randomBytes(16).toString('hex');


        const userID = result[0][0].id;
        result = await connection.execute("INSERT INTO sessions(user_id, auth_key) VALUES(?, ?)", [userID, key]);

        const authKey = {
            authKey: key
        }

        res.json(authKey);

    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            message: "Server error"
        })
    }

})

app.post('/todos',[authorization], async (req, res) => {

    try {

        const userKey = req.get("Authorization");

        let todosResult = await connection.execute("SELECT id, content, status FROM todos INNER JOIN sessions ON todos.user_id =  sessions.user_id WHERE sessions.auth_key = ?", [userKey]);

        if (todosResult[0].length == 0) {
            return res.status(401).json({
                message: "There are no todos to display"
            })
        }
    
        todosResult[0].forEach(element => {
            if(element.status == 1)
                element.status = true;
            else
                element.status = false;
        });

        res.json(todosResult[0]);

        
    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            message: "Server error"
        })
    }
})

app.listen(3000);