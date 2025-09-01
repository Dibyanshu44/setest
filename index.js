import express from "express";
var port=3000;
var app= express();
import path from "path";
import { fileURLToPath } from "url";
import pool from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/images", express.static("views/images"));
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(express.static("public"));

import session from "express-session";

app.use(session({
  secret: "han_dekhle-bsdk236", 
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));



app.get('/', (req, res) => {
  const rollno = req.session.user || null;  // null if not logged in
  res.render('home.ejs', { login: !!rollno, rollno });
});

app.get("/login",(req,res)=>{
    res.render("login.ejs",{code:null,page:"Log-in"});
});

app.get("/signup", (req, res) => {
  res.render("login.ejs", {code:null,page: "Sign-up" });
});

app.post("/Sign-up", async (req, res) => {
  const user = req.body.user;
  const pass = req.body.pass;
  try {
    const check = await pool.query("SELECT * FROM users WHERE roll_no=$1", [user]);
    if (check.rows.length > 0) {
      res.render("login.ejs", { code: "Username already taken", page: "Sign-up" });
    } else {
      await pool.query("INSERT INTO users(roll_no, password_hash) VALUES ($1, $2)", [user, pass]);
      req.session.user = user;
      res.render("home.ejs",{rollno:user,login: true});
    }
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).send("Error fetching users");
  }
});

app.post("/Log-in", async (req, res) => {
  const user = req.body.user;
  const pass = req.body.pass;
  const usercheck = await pool.query("SELECT * FROM users WHERE roll_no=$1", [user]);
  if (usercheck.rows.length === 0) {
    res.render("login.ejs", { code: "Username not found!", page: "Log-in" });
  } else {
    const passcheck = await pool.query("SELECT password_hash FROM users WHERE roll_no=$1", [user]);
    if (pass === passcheck.rows[0].password_hash) {
        req.session.user = user;
      res.render("home.ejs",{rollno:user,login: true});
    } else {
      res.render("login.ejs", { code: "Incorrect Password", page: "Log-in" });
    }
  }
});

app.get("/about",(req,res)=>{
    res.render("about.ejs");
});

app.get("/calendar",(req,res)=>{
    res.render("calendar.ejs");
});

app.get("/contact",(req,res)=>{
    res.render("contact.ejs");
});

app.get("/nav",(req,res)=>{
    res.render("nav.ejs");
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error(err);
    res.redirect('/');
  });
});


app.listen(port,()=>{
    console.log("server running on port "+port);
});