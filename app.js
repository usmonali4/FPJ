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
const firebase = require("firebase/app");
const {getStorage, ref, uploadBytes, getDownloadURL} = require("firebase/storage");

const firebaseConfig = {
  apiKey: "AIzaSyBKDY13fVIWCtTsMsjwgv1bL4t9bsh_Tx8",
  authDomain: "bbshop-400904.firebaseapp.com",
  projectId: "bbshop-400904",
  storageBucket: "bbshop-400904.appspot.com",
  messagingSenderId: "405340450273",
  appId: "1:405340450273:web:b7d55f60094a18aedcb6a0",
  //measurementId: "G-D21H3LVKXQ"
};

firebase.initializeApp(firebaseConfig);

const storage = getStorage();

const upload = multer({ storage: multer.memoryStorage() })

const app = express();
const PORT = 3000;

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

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true});
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  googleId: String,
  //products: [productSchema],
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
  User.findOrCreate({ googleId: profile.id, username: profile.displayName }, function (err, user) {
    return cb(err, user);
  });
}
));

app.get("/in", (req, res) => {
  res.render("in")
});

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
  User.register({email: req.body.email, username: req.body.username}, req.body.password, function(err, user){
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
});

app.get("/product/:prodId", async (req, res) => {
  const prodId = req.params.prodId;
  const prod = await Product.findById(prodId).exec();
  prod.views++;
  prod.save();

  res.render("product", {product: prod});
})

app.post("/add-product", upload.single('image'), async (req, res) => {
  
  const storageRef = ref(storage, `productsPhotos/${Date.now() + "-" +req.file.originalname}`);
  const metadata = {
    contentType: req.file.mimetype,
};
  const snapshot = await uploadBytes(storageRef, req.file.buffer, metadata);
  const url = await getDownloadURL(snapshot.ref);
  
  const {name, type, price, description} = req.body;

  const product = new Product({
    name,
    type,
    price, 
    description,
    image: url,
    views: 0,
  })
  //console.log(req.file);
  //console.log(product.image);
  product.save();
  res.redirect("/");
})

connectDB().then(() => {
  app.listen(PORT, () => {
      console.log("listening for requests");
  })
})
