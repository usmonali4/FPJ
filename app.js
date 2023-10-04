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
const findOrCreate = require('mongoose-findorcreate');
const multer  = require('multer');
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images')
  },
  filename: function (req, file, cb) {
    // const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    // cb(null, file.fieldname + '-' + uniqueSuffix)
    console.log(file);
    cb(null, Date.now() + path.extname(file.originalname));
  }
})

const upload = multer({ storage: storage })

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
  googleId: String,
});

const productSchema = new mongoose.Schema({
  name: String,
  category: String,
  type: String,
  description: String,
  price: Number,
  views: Number,
  available: Boolean,
  image: String,
})

const Product = new mongoose.model("Product", productSchema);

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

app.get("/in", (req, res) => {
  res.render("in")
})

app.get("/", async function(req, res) {
    const arr = await Product.find({}).exec();
    res.render("home", {req_: req, products: arr});
});

app.get("/register", function(req, res){
  res.render("register", {req_: req});
});

app.get("/login", function(req, res){
  res.render("login", {req_: req});
});

app.get("/add-product", (req, res) => {
  if(req.isAuthenticated()){
    res.render("addProduct", {req_: req});
  } else {
    res.redirect("/login");
  }
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

app.post("/add-product", upload.single('image'), (req, res) => {
  const {name, type, price, description} = req.body;
  const {fieldname, filename} = req.file;
  const product = new Product({
    name,
    type,
    price, 
    description,
    image: `/images/${filename}`,
  })
  product.save();
  res.redirect("/");
})

app.listen(3000, function() {
  console.log("Server started on port 3000");
});
