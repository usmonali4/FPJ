//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs")
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const session = require("express-session");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate')

const app = express();

app.set('view engine', 'ejs');
app.set("trust proxy", 1);

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
  secret: "This is some secret",
  resave: false,
  saveUninitialized: false,
  //cookie: {secure: true},
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/shopDB");

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  googleId: String
});

const productSchema = new mongoose.Schema({
  name: String,
  category: String,
  type: String,
  price: Number,
  views: Number,
  available: Boolean,

})

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, {
      id: user.id,
      username: user.username,
      picture: user.picture
    });
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
      return cb(null, user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/kholat",
},
function(accessToken, refreshToken, profile, cb) {
  console.log(profile);
  User.findOrCreate({ googleId: profile.id }, function (err, user) {
    return cb(err, user);
  });
}
));


app.get("/", function(req, res) {
    res.render("home", {req_: req})
});

app.get("/register", function(req, res){
  res.render("register", {req_: req});
});

app.get("/login", function(req, res){
  res.render("login", {req_: req});
});

app.get("/add-product", (req, res) => {
  res.render("addProduct");
})

app.get("kholat", (req, res) => {
  res.render("kholat");
})

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile"] }));

app.get("/auth/google/kholat", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/");
  });

app.post("/register", function(req, res){
  User.register({username: req.body.username}, req.body.password, function(err, user){
    if(err){
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/");
      })
    }
  })
})

app.post("/login", function(req, res){
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  })

  req.login(user, async function(err){
    if(err){
      console.log(err);
      res.redirect("/login");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/");
      })
    }
  })
})

app.get("/logout", function(req, res){
  req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
  });
})

app.listen(3000, function() {
  console.log("Server started on port 3000");
});
