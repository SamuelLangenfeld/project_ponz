const express = require('express');
const app = express();


// ----------------------------------------
// App Variables
// ----------------------------------------
app.locals.appName = 'My App';


// ----------------------------------------
// ENV
// ----------------------------------------
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}


// ----------------------------------------
// Body Parser
// ----------------------------------------
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));


// ----------------------------------------
// Sessions/Cookies
// ----------------------------------------
const cookieSession = require('cookie-session');

app.use(cookieSession({
  name: 'session',
  keys: [
    process.env.SESSION_SECRET || 'secret'
  ]
}));

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});


// ----------------------------------------
// Flash Messages
// ----------------------------------------
const flash = require('express-flash-messages');
app.use(flash());


// ----------------------------------------
// Method Override
// ----------------------------------------
const methodOverride = require('method-override');
const getPostSupport = require('express-method-override-get-post-support');

app.use(methodOverride(
  getPostSupport.callback,
  getPostSupport.options // { methods: ['POST', 'GET'] }
));


// ----------------------------------------
// Referrer
// ----------------------------------------
app.use((req, res, next) => {
  req.session.backUrl = req.header('Referer') || '/';
  next();
});


// ----------------------------------------
// Public
// ----------------------------------------
app.use(express.static(`${__dirname}/public`));


// ----------------------------------------
// Logging
// ----------------------------------------
const morgan = require('morgan');
const morganToolkit = require('morgan-toolkit')(morgan);

app.use(morganToolkit());


// ----------------------------------------
// Passport
// ----------------------------------------
const passport = require("passport");
app.use(passport.initialize());
app.use(passport.session());

const User = require("./models/user");
const mongoose = require("mongoose");
mongoose.connect("mongodb://localhost/ponz");

const LocalStrategy = require("passport-local").Strategy;

passport.use(
  new LocalStrategy(function(username, password, done) {
    User.findOne({ username }, function(err, user) {
      console.log(user);
      if (err) return done(err);
      if (!user || !user.validPassword(password)) {
        return done(null, false, { message: "Invalid username/password" });
      }
      return done(null, user);
    });
  })
);

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// ----------------------------------------
// Routes
// ----------------------------------------

app.get("/", async(req, res) => {
  if (req.user) {
    let parent = await User.findById(req.user.parent);

    res.render("home", { user: req.user, parent: parent });
  } else {
    res.redirect("/login");
  }
});

// 2
app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register/:id", (req, res) => {
  res.render("register", { parentId: req.params.id });
});

app.get("/register", (req, res) => {
  res.render("register");
});

// 3
app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true
  })
);

// 4
const ponzPointz = (ponzDist) => {
  let pointz = 40;
  return (((Math.trunc(pointz * (0.5 ** ponzDist)))) || 1);
}



const rewardUsers = async(parentId) => {
  let distance = 1;
  let parent = await User.findById(parentId)
  while (parent) {
    parent.points += ponzPointz(distance);
    distance++;
    await parent.save();
    parent = await User.findById(parent.parent);
  }
}

const punishUsers = async(parentId) => {
  let distance = 1;
  let parent = await User.findById(parentId)
  while (parent) {
    parent.points -= ponzPointz(distance);
    distance++;
    await parent.save();
    parent = await User.findById(parent.parent);
  }
}

app.post("/register", async function(req, res, next) {
  const { username, password } = req.body;
  const parentId = req.body.parentId;
  const user = new User({ username, password, parent: parentId, points: 0 });
  try {
    let savedUser = await user.save();
    let parent = await User.findById(savedUser.parent);
    parent.children.push(savedUser.id);
    await parent.save();
    await rewardUsers(savedUser.parent);
    req.login(user, function(err) {
      if (err) {
        return next(err);
      }
      return res.redirect("/");
    });
  } catch (e) {
    console.log(e);
  }
});

// 5
app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});



app.use('/', (req, res) => {
  req.flash('Hi!');
  res.render('welcome/index');
});


// ----------------------------------------
// Template Engine
// ----------------------------------------
const expressHandlebars = require('express-handlebars');
const helpers = require('./helpers');

const hbs = expressHandlebars.create({
  helpers: helpers,
  partialsDir: 'views/',
  defaultLayout: 'application'
});

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');


// ----------------------------------------
// Server
// ----------------------------------------
const port = process.env.PORT ||
  process.argv[2] ||
  3000;
const host = 'localhost';

let args;
process.env.NODE_ENV === 'production' ?
  args = [port] :
  args = [port, host];

args.push(() => {
  console.log(`Listening: http://${ host }:${ port }\n`);
});

if (require.main === module) {
  app.listen.apply(app, args);
}


// ----------------------------------------
// Error Handling
// ----------------------------------------
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.stack) {
    err = err.stack;
  }
  res.status(500).render('errors/500', { error: err });
});


module.exports = app;