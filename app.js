const express = require('express');
const app = express();
var Promise = require("bluebird");
const store = require('./routers/store');


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

// ---------------------------------------------------------
// Redis 
// 2017-12-13 13:46
// ---------------------------------------------------------

const redis = require('redis');
Promise.promisifyAll(redis);
const redisClient = redis.createClient();
//----------------------------------
//Build Redis Tree Section
//Only do if tree in redis does not exist
//--------------------------------------

(async() => {
  redisClient.exists("tree", (err, tree) => {
    if (!tree) {
      let recurseTree = async(user) => {
        user.children = await Promise.all(user.children.map(async(child) => {
          let fullChild = await User.findById(child, { _id: 1, children: 1 });
          if (fullChild.children.length > 0) {
            await recurseTree(fullChild);
          }
          return fullChild;

        }))

      }

      let buildTree = async() => {
        let tree = { id: null, children: [] };
        tree.children = await User.find({ parent: null }, { _id: 1, children: 1 }); // returns array
        await recurseTree(tree);
        return tree
      }

      buildTree().then(tree => {
        //console.log(JSON.stringify(tree, null, 2));
        let stringTree = JSON.stringify(tree);
        redisClient.set('tree', stringTree);
      });
    }

  });

})();

//-----------------------------------------
//Find node in a node tree function
//-----------------------------------------

async function findNode(userId, tree) {
  if (tree._id == userId) {
    return tree;
  }
  var result;
  for (let child of tree.children) {
    result = await findNode(userId, child);
    if (result) {
      return result;
    }
  }
}

//-----------------------------------------
//Test find node function
//-----------------------------------------


/*

(async () => {
  let user =await User.findOne({ username: 'Sanford_Bergstrom' });
  console.log(`Sanford ID ${user.id}`)
  redisClient.get('tree', async (err, tree)=>{
    tree = JSON.parse(tree);
    let node =await findNode(user.id, tree);
    console.log("FINAL");
    console.log(node);
    console.log(node.children);
  });
})();

*/

/*
ASYNC REDIS EXAMPLE FOR FUTURE USE
(async()=>{
  console.log('here')
  let tree=await redisClient.getAsync('tree')
  console.log(tree);
})()
*/

// ----------------------------------------
// Routes
// ----------------------------------------


app.get("/", async(req, res) => {
  if (req.user) {
    let parent = await User.findById(req.user.parent);
    let user = req.user;

    //---------------------------------
    //Grab correct node from Redis tree
    //---------------------------------

    let tree = await redisClient.getAsync('tree');
    tree = JSON.parse(tree);
    let userNode = await findNode(user.id, tree);


    //--------------------------------
    // Get all ids from the node tree
    //--------------------------------

    let userIds = [];

    function grabIds(node) {
      userIds.push({ _id: node._id });
      node.children.forEach(child => {
        grabIds(child);
      })
    };

    let users = [];



    grabIds(userNode);

    //--------------------------------------------------
    // Make a database call to gather every user needed
    //--------------------------------------------------

    users = await User.find({ $or: userIds });


    //--------------------------------------------------
    // Assign user attributes to each node
    //--------------------------------------------------
    function assignAttributes(node) {
      targetUser = users.find(el => {
        return (el._id == node._id)
      })
      node.username = targetUser.username;
      node.points = targetUser.points;
      node.parent = targetUser.parent;
      node.id = targetUser.id;
      node.items = targetUser.items

      node.children.forEach(child => {
        assignAttributes(child);
      })

    };


    assignAttributes(userNode);

    //----------------------------------------------
    // Make the different levels for the CSS pyramid
    //----------------------------------------------

    let pyramid = []
    let level = 0;

    //Basic idea
    //[1, 2, 4, 2, 5, etc]
    /*
    UserNode has nested objects.
    Need to use recursion
    */



    function calcPyramid(node, pyramid) {
      if (pyramid[level] === undefined) {
        pyramid.push(0);
      }
      pyramid[level] = pyramid[level] + 1;
      node.children.forEach(child => {
        level += 1;
        calcPyramid(child, pyramid);
        level -= 1;
      });
    }


    calcPyramid(userNode, pyramid);
    console.log(pyramid)
    console.log(userNode.items);

    res.render("home", { user: userNode, parent: parent, pyramid });
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

app.use('/store', store);


// 4
const ponzPointz = (ponzDist) => {
  let pointz = 40;
  return (((Math.trunc(pointz * (0.5 ** (ponzDist - 1))))) || 1);
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
    let tree = await redisClient.getAsync('tree');
    tree = JSON.parse(tree);
    let parentNode = await findNode(parent.id, tree);
    parentNode.children.push({ _id: savedUser._id, children: [] });
    let stringTree = JSON.stringify(tree);
    await redisClient.setAsync('tree', stringTree);
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