/*
  app.js -- This creates an Express webserver with login/register/logout authentication
*/

// *********************************************************** //
//  Loading packages to support the server
// *********************************************************** //
// First we load in all of the packages we need for the server...
const createError = require("http-errors"); // to handle the server errors
const express = require("express");
const path = require("path");  // to refer to local paths
const cookieParser = require("cookie-parser"); // to handle cookies
const session = require("express-session"); // to handle sessions using cookies
const debug = require("debug")("personalapp:server"); 
const layouts = require("express-ejs-layouts");
const axios = require("axios")

// *********************************************************** //
//  Loading models
// *********************************************************** //
const User = require("./models/User")
const Password = require('./models/Password')


// *********************************************************** //
//  Connecting to the database
// *********************************************************** //

const mongoose = require( 'mongoose' );
const mongodb_URI = process.env.MONGODB_URI

mongoose.connect( mongodb_URI, { useNewUrlParser: true, useUnifiedTopology: true } );
mongoose.set('useFindAndModify', false); 
mongoose.set('useCreateIndex', true);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {console.log("we are connected!!!")});





// *********************************************************** //
// Initializing the Express server 
// This code is run once when the app is started and it creates
// a server that respond to requests by sending responses
// *********************************************************** //
const app = express();

// Here we specify that we will be using EJS as our view engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");



// this allows us to use page layout for the views 
// so we don't have to repeat the headers and footers on every page ...
// the layout is in views/layout.ejs
app.use(layouts);

// Here we process the requests so they are easy to handle
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Here we specify that static files will be in the public folder
app.use(express.static(path.join(__dirname, "public")));

// Here we enable session handling using cookies
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
  })
);

// *********************************************************** //
//  Defining the routes the Express server will respond to
// *********************************************************** //


// here is the code which handles all /login /signin /logout routes
const auth = require('./routes/auth');
const { deflateSync } = require("zlib");
app.use(auth)

// middleware to test is the user is logged in, and if not, send them to the login page
const isLoggedIn = (req,res,next) => {
  if (res.locals.loggedIn) {
    next()
  }
  else res.redirect('/login')
}

// specify that the server should render the views/index.ejs page for the root path
// and the index.ejs code will be wrapped in the views/layouts.ejs code which provides
// the headers and footers for all webpages generated by this app
app.get("/", (req, res, next) => {
  res.render("index");
});

app.get("/signup", (req, res, next) => {
  res.render("signup");
});

app.get('/create-password',
    isLoggedIn,
    async (req,res,next) => {
        try{
        res.render("create-password");
        } catch (e){
        next(e);
        }
    }
)

app.post('/create-password',
    isLoggedIn,
    async (req,res,next) => {
    try {
        const {name,username,password,description,url} = req.body;
        const ownerID = res.locals.user._id;
        const creationTime = new Date();
        let data = {name,username,password,description,url,ownerID,creationTime}
        let item = new Password(data)
        await item.save() 
        res.redirect('/password/' + item._id)
    } catch (e){
        next(e);
    }
    }
)

app.get('/delete-password/',
    isLoggedIn,
    async (req,res,next) => {
    try {
        const {passwordID} = req.params.passwordID;
        await Password.findByIdAndDelete(passwordID)
        res.redirect('/vault')
    } catch (e){
        next(e);
    }
    }
)

app.post('/search',
    isLoggedIn,
    async (req,res,next) => {
    try {
        const {searchQuery} = req.body;
        res.redirect('/search/' + searchQuery)
    } catch (e){
        next(e);
    }
    }
)

app.get('/search/:searchQuery',
    isLoggedIn,
    async (req,res,next) => {
    try {
        res.locals.searchResults = await Password.find({name:req.params.searchQuery})
        res.render('search')
    } catch (e){
        next(e);
    }
    }
)

app.get("/profile/:profileUsername", async (req, res, next) => {
  try {
    res.locals.profileData = await User.findOne({username:req.params.profileUsername})
    console.log(res.locals.profileData)
    res.render("profile");
  } catch (e){
    next(e);
}
});

  app.get("/password/:passwordID",
    isLoggedIn,
    async (req,res,next) => {
      try{
        const passwordID = req.params.passwordID
        res.locals.password = await Password.findById(passwordID)
        console.log(res.locals.password)
        res.render('password')
      } catch (e){
        next(e);
      }
    }
  )

  app.get("/password/:passwordID/update",
    isLoggedIn,
    async (req,res,next) => {
      try{
        res.locals.password = await Password.findById(req.params.passwordID)
        res.render('update_password')
      } catch (e){
        next(e);
      }
    }
  )

  app.post("/password/:passwordID/update",
    isLoggedIn,
    async (req,res,next) => {
      try{
        const {name,username,password,description,url} = req.body;
        res.locals.password = await Password.findByIdAndUpdate(req.params.passwordID, {name,username,password,description,url})
        res.redirect('/password/' + req.params.passwordID)
      } catch (e){
        next(e);
      }
    }
  )

  app.get("/password/:passwordID/delete",
    isLoggedIn,
    async (req,res,next) => {
      try{
        res.locals.password = await Password.findById(req.params.passwordID)
        res.render('confirm_password_deletion')
      } catch (e){
        next(e);
      }
    }
  )

  app.get("/delpass/:passwordID",
    isLoggedIn,
    async (req,res,next) => {
      try{
        await Password.findByIdAndDelete(req.params.passwordID)
        res.redirect('/vault')
      } catch (e){
        next(e);
      }
    }
  )

  app.get("/vault",
  isLoggedIn,
  async (req,res,next) => {
    try{
        res.locals.passwords = await Password.find({})
        res.render('vault') // go back to the todo page
    } catch (e){
      next(e);
    }
  }
)


// here we catch 404 errors and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// this processes any errors generated by the previous routes
// notice that the function has four parameters which is how Express indicates it is an error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  // render the error page
  res.status(err.status || 500);
  res.render("error");
});


// *********************************************************** //
//  Starting up the server!
// *********************************************************** //
//Here we set the port to use between 1024 and 65535  (2^16-1)
const port = process.env.PORT || "5000"
app.set("port", port);

// and now we startup the server listening on that port
const http = require("http");
const server = http.createServer(app);

server.listen(port);

function onListening() {
  var addr = server.address();
  var bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  debug("Listening on " + bind);
}

function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  var bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}

server.on("error", onError);

server.on("listening", onListening);

module.exports = app;
