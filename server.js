//This WIP Script runs a server that handles user authentication and authorization using JWTs
//DONE: registering users to a database with an encrypted password
//TODO: login system, logout system, basic posting functionality

//-------------------------------------------------------------------[HEADER/BOILERPLATE CODE]--------------------------------------------------------------------------------------------

//loading configuration file to access data as environemnt variables
require("dotenv").config()

//importing modules for server operation
const express = require("express");
const bcrypt = require("bcrypt");
const mysql = require("mysql");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const path = require("path");
const crypto = require("crypto");

//-------------------------------------------------------------------[BASIC SERVER SETUP]--------------------------------------------------------------------------------------------------

//Checking for presense of secret key, and generating key if not present
if(!process.env.JWT_SECRET_KEY || process.env.JWT_SECRET_KEY == ""){
    console.log("No Secret key found");
    if(process.env.GENERATE_KEY == true){
        newKey = crypto.randomBytes(64).toString("hex");
        process.env.JWT_SECRET_KEY = newKey;
        console.log("Secret key generated");
    } else {
        console.log("Please enter secret key");
        return;
    }
} else {
    console.log("Secret key found")
}

//creating connection pool to the database, and testing database connection
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    connectionLimit: process.env.DB_CONNECTION_LIMIT
});
const connection = pool.getConnection((err, connection) => {
    if(err){
        console.log("Error getting connection:",err);
        return;
    } else {
        connection.query("SHOW STATUS",(queryErr,queryRes)=>{
            if(queryErr) {
                console.log("Error getting status");
                return;
            } else {
                console.log("Database Connected");
                connection.release();
            };
        });
    };
});

//creating custom middleware function to check for authorisation
const checkAuthCookie = (req,res,next) => {
    const targetCookieName = "authToken";
    if (!req.cookies[targetCookieName]) {
        next()
    } else {
        const cookieContent = req.cookies[targetCookieName];
        jwt.verify(cookieContent, process.env.JWT_SECRET_KEY, (err,user) =>{
            if (err) {
                res.clearCookie("authToken");
                next();
            } else {
                req.user = user;
                next();
            };
        });
    };   
};

//Initializing app for the server to use
const app = express();

//-------------------------------------------------------------------[ROUTING SETUP]--------------------------------------------------------------------------------------------

//Setting up middleware to handle JSON files, cookies, static filesystem, and auth check
app.use(express.json());
app.use(cookieParser());
app.use("/", express.static(path.join(__dirname, "/static")));
app.use(checkAuthCookie);

app.get("/", async(req,res)=>{
    const index = path.join(__dirname, 'static/html', 'index.html');
    res.sendFile(index);
});

//Auth Handling------------------------------------------------------------------------------------------------

//Endpoint handling user registration
app.post("/user/register",async(req,res)=>{
    try {
        console.log(req.body);
        //Validating Data sent by the user 
        //TODO: limit password further to exclude larger characters (like emoji), to not go over maximum allowed by hasing algorithm
        if (!req.body || !req.body.username || !req.body.password) {
            res.status(400).send("Data incomplete");
            return;
        };
        if (req.body.username.length >= 32) {
            res.status(400).send("Username too long");
            return;
        };
        if (req.body.password.length >= 50) {
            res.status(400).send("Password too long");
            return;
        };
        
        //beginning asynchronous hashing of password
        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(req.body.password, salt);
        
        //obtaining database connection from pool
        const connection = await new Promise((resolve, reject) => {
            pool.getConnection((err, connection) => {
                if(err){
                    console.log("Error getting connection:",err);
                    reject(err);
                    res.status(500).send("Internal Server Error");
                } else {
                    resolve(connection);
                };
            });
        });

        //checking if user already exists in database
        const user = await new Promise((resolve,reject) => {
            connection.query("SELECT * FROM users WHERE username = ?",req.body.username,(queryErr,queryRes) => {
                if(queryErr){
                    console.log(queryErr);
                    reject(queryErr);
                    res.status(500).send("Internal Server Error");
                } else {
                    resolve(queryRes);
                };
            });
        });
        if(user.length != 0) {
            res.status(400).send("Username already in use").send();
            return;
        }
        
        //entering user into database, after data has been validated
        connection.query("INSERT INTO users(username,password) VALUES (?,?)",[req.body.username, hashedPassword],(queryErr,queryRes)=>{
            if(queryErr){
                console.log(queryErr);
                res.status(500).send("Internal Server Error");
            } else {
                console.log("User Successfully created:",queryRes);
                connection.release();
                res.status(201).send("User successfully created");
            };
        });
    } catch {
        res.status(500).send("Internal Server Error");
    };
});

//Endpoint handling user authentication
app.post("/user/login",async (req,res)=>{
    try {
        //Validating Data sent by user
        if (!req.body || !req.body.username || !req.body.password) {
            res.status(400).send("Data incomplete");
            return;
        };
        if (req.body.username.length >= 32) {
            res.status(400).send("Username too long");
            return;
        };
        if (req.body.password.length >= 50) {
            res.status(400).send("Password too long");
            return;
        };
        if(req.user && req.body.username == req.user.username) {
            res.status(400).send("User already logged in");
            return;
        }
        //obtaining database connection from pool
        const connection = await new Promise((resolve, reject) => {
            pool.getConnection((err, connection) => {
                if(err){
                    console.log("Error getting connection:",err);
                    reject(err);
                    res.status(500).send("Internal Server Error");
                } else {
                    resolve(connection);
                };
            });
        });
        //Get user info from database
        const user = await new Promise((resolve,reject) => {
            connection.query("SELECT * FROM users WHERE username = ?",req.body.username,(queryErr,queryRes) => {
                if(queryErr){
                    console.log(queryErr);
                    reject(queryErr);
                    res.status(500).send("Internal Server Error");
                } else if(queryRes.length != 1) {
                    res.status(401).send("User doesnt exist");
                } else {
                    connection.release();
                    resolve(queryRes[0]);
                }
            });
        });
        //Compare password to password stored in database
        const valid = await bcrypt.compare(req.body.password,user.password);
        if(!valid) {
            res.status(401).send("Password Incorrect");
        } else {
            //Collect Data for JWT payload
            const payload = {
                sub: user.user_id,
                username: user.username,
            }
            //Delete old token, if another user was already logged in
            if(req.user){
                res.clearCookie("authToken");
            };
            //Generate JWT and set as cookie
            const accessToken = jwt.sign(payload, process.env.JWT_SECRET_KEY)
            res.cookie("authToken", accessToken, {
                maxAge: 24*60*60*1000,
                httpOnly: true
            });
            res.status(201).send("User logged in");
        }
    } catch(error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
})

//Endpoint logging users out
app.delete("/user/logout",async(req,res)=>{
    try{
        if(!req.user) {
            res.status(401).send();
        } else {
            res.clearCookie("authToken");
            res.status(204).send("User Successfully logged out");
        }
    } catch {
        res.status(500).send();
    }
})

//Endpoint for client to check if theyre authenticated
app.get("/user/checkauth", async (req,res)=>{ 
    if(req.user){    
        res.json({user: req.user.username});
    } else {
        res.status(401).send();
    }
})

//Post Handling-------------------------------------------------------------------------------------------------

//Endpoint handling post creation
app.post("/posts/create",async (req,res)=>{
    //check user authorisation and input data
    if(!req.user) {
        res.status(401).send("Not Auhtorized");
        return;
    };
    if(!req.body || !req.body.postTitle || !req.body.postContent) {
        res.status(400).send("Data Incomplete");
        return;
    }
    if(req.body.postTitle >= 100) {
        res.status(400).send("Title too long");
        return;
    }
    if(req.body.postContent >= 500) {
        res.status(400).send("Content too long");
        return;
    }
    try {
        const connection = await new Promise((resolve, reject) => {
            pool.getConnection((err, connection) => {
                if(err){
                    console.log("Error getting connection:",err);
                    reject(err);
                    res.status(500).send("Internal Server Error");
                } else {
                    resolve(connection);
                };
            });
        });
        console.log(req.body.postTitle);
        const post = await new Promise((resolve,reject) => {
            connection.query("SELECT * FROM posts WHERE post_title = ?",req.body.postTitle,(queryErr,queryRes) => {
                if(queryErr){
                    console.log(queryErr);
                    reject(queryErr);
                } else {
                    resolve(queryRes[0]);
                };
            });
        });
        if(post) {
            res.status(400).send("Post Already exists");
            return;
        }
        connection.query("INSERT INTO posts (author_id, post_content, post_title) VALUES (?,?,?)",[req.user.sub,req.body.postContent,req.body.postTitle],(queryErr,queryRes)=>{
            if(queryErr){
                console.log(queryErr);
                res.status(500).send("Database Error");
            } else {
                console.log("Post Successfully created:", queryRes);
                connection.release();
                res.status(201).send("Post Successfully Created");
            };
        });
    } catch(error) {
        console.log(error);
    };
});

//Endpoint for sending posts out to user
app.get("/posts/get",async (req,res)=>{
    try{
        const connection = await new Promise((resolve, reject) => {
            pool.getConnection((err, connection) => {
                if(err){
                    console.log("Error getting connection:",err);
                    reject(err);
                    res.status(500).send("Internal Server Error");
                } else {
                    resolve(connection);
                };
            });
        });
        const query = `
        SELECT users.username AS author, posts.post_title,posts.post_content,posts.created_at
        FROM posts
        INNER JOIN users ON posts.author_id = users.user_id
        ORDER BY created_at DESC;`
        const posts = await new Promise((resolve,reject)=> {
            connection.query(query,(queryErr,queryRes)=>{
                if(queryErr){
                    console.log(queryErr);
                    res.status(500).send();
                    reject(queryErr);                   
                } else {
                    resolve(queryRes);
                };
            });
            connection.release();
        });

        res.status(200).json(posts);
    } catch(error) {
        console.log(error);
        res.status(500).send();
    }
});

//Setting up server to listen on specified port and host
app.listen(process.env.SV_PORT,process.env.SV_HOST,()=>{
    console.log(`Server running on ${process.env.SV_HOST} with port ${process.env.SV_PORT}`);
});