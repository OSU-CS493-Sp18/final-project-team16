const router = require('express').Router();
const bcrypt = require('bcryptjs');
const ObjectId = require('mongodb').ObjectId;

const { generateAuthToken, requireAuthentication } = require('../lib/auth');

function validateUserObject(user) {
  return user && user.userID && user.password;
}

function insertNewUser(user, mongoDB) {
  return bcrypt.hash(user.password, 8)
    .then((passwordHash) => {
      const userDocument = {
        userID: user.userID,
        password: passwordHash,
        recipes: [],
		reviews: []
      };
      const usersCollection = mongoDB.collection('users');
      return usersCollection.insertOne(userDocument);
    })
    .then((result) => {
      return Promise.resolve(result.insertedId);
    });
}

router.post('/', function (req, res) {
  const mongoDB = req.app.locals.mongoDB;
  if (validateUserObject(req.body)) {
    insertNewUser(req.body, mongoDB)
      .then((id) => {
        res.status(201).json({
          _id: id,
          links: {
            user: `/users/${id}`
          }
        });
      })
      .catch((err) => {
        res.status(500).json({
          error: "Failed to insert new user."
        });
      });
  } else {
    res.status(400).json({
      error: "Request doesn't contain a valid user."
    })
  }
});

router.post('/login', function (req, res) {
  const mongoDB = req.app.locals.mongoDB;
  if (req.body && req.body.userID && req.body.password) {
    getUserByID(req.body.userID, mongoDB, true)
      .then((user) => {
        if (user) {
          return bcrypt.compare(req.body.password, user.password);
        } else {
          return Promise.reject(401);
        }
      })
      .then((loginSuccessful) => {
        if (loginSuccessful) {
          return generateAuthToken(req.body.userID);
        } else {
          return Promise.reject(401);
        }
      })
      .then((token) => {
        res.status(200).json({
          token: token
        });
      })
      .catch((err) => {
        console.log(err);
        if (err === 401) {
          res.status(401).json({
            error: "Invalid credentials."
          });
        } else {
          res.status(500).json({
            error: "Failed to fetch user."
          });
        }
      });
  } else {
    res.status(400).json({
      error: "Request needs a user ID and password."
    })
  }
});

function getUserByID(userID, mongoDB, includePassword) {
  const usersCollection = mongoDB.collection('users');
  const projection = includePassword ? {} : { password: 0 };
  return usersCollection
    .find({ userID: userID })
    .project(projection)
    .toArray()
    .then((results) => {
      return Promise.resolve(results[0]);
    });
}

router.get('/:userID', requireAuthentication, function (req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  if (req.user !== req.params.userID) {
    res.status(403).json({
      error: "Unauthorized to access that resource"
    });
  } else {
    getUserByID(req.params.userID, mongoDB)
      .then((user) => {
        if (user) {
          res.status(200).json(user);
        } else {
          next();
        }
      })
      .catch((err) => {
        res.status(500).json({
          error: "Failed to fetch user."
        });
      });
  }
});

function getRecipesByOwnerID(ownerID, mysqlPool) {
  return new Promise((resolve, reject) => {
    mysqlPool.query('SELECT * FROM recipes WHERE ownerid = ?', [ ownerID ], function (err, results) {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
}

router.get('/:userID/recipes', function (req, res, next) {
  const mysqlPool = req.app.locals.mysqlPool;
  const ownerID = parseInt(req.params.userID);
  getRecipesByOwnerID(ownerID, mysqlPool)
    .then((ownerRecipes) => {
      res.status(200).json({
        recipes: ownerRecipes
      });
    })
    .catch((err) => {
      res.status(500).json({
        error: `Unable to fetch recipes for user ${ownerID}`
      });
    });

});

function getReviewsByOwnerID(ownerID, mysqlPool) {
  return new Promise((resolve, reject) => {
    mysqlPool.query('SELECT * FROM reviews WHERE ownerid = ?', [ ownerID ], function (err, results) {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
}

router.get('/:userID/reviews', function (req, res, next) {
  const mysqlPool = req.app.locals.mysqlPool;
  const ownerID = parseInt(req.params.userID);
  getReviewsByOwnerID(ownerID, mysqlPool)
    .then((ownerReviews) => {
      res.status(200).json({
        reviews: ownerReviews
      });
    })
    .catch((err) => {
      res.status(500).json({
        error: `Unable to fetch reviews for user ${ownerID}`
      });
    });

});

function addRecipeToUser(recipeID, userID, mongoDB) {
  const usersCollection = mongoDB.collection('users');
  return usersCollection.updateOne(
    { userID: userID },
    { $push: { recipes: recipeID } }
  ).then(() => {
    return Promise.resolve(recipeID);
  });
}

function addReviewToUser(reviewID, userID, mongoDB) {
  const usersCollection = mongoDB.collection('users');
  return usersCollection.updateOne(
    { userID: userID },
    { $push: { reviews: reviewID } }
  ).then(() => {
    return Promise.resolve(reviewID);
  });
}

exports.router = router;
exports.getUserByID = getUserByID;
exports.addRecipeToUser = addRecipeToUser;
exports.addReviewToUser = addReviewToUser;