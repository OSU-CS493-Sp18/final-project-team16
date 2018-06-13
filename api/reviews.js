const router = require('express').Router();
const { addReviewToUser, getUserByID } = require('./users');

function validateReviewObject(review) {
  return review && review.recipeID && review.userID && review.title && review.rating;
}

function getReviewCount(mysqlPool) {
  return new Promise((resolve, reject) => {
    mysqlPool.query('SELECT COUNT(*) AS count FROM reviews', function (err, results) {
      if (err) {
        reject(err);
      } else {
        resolve(results[0].count);
      }
    });
  });
}

function getReviewsPage(page, totalCount, mysqlPool) {
  return new Promise((resolve, reject) => {
    const numPerPage = 10;
    const lastPage = Math.ceil(totalCount / numPerPage);
    page = page < 1 ? 1 : page;
    page = page > lastPage ? lastPage : page;
    const offset = (page - 1) * numPerPage;
    mysqlPool.query('SELECT * FROM reviews ORDER BY id LIMIT ?,?', [offset, numPerPage], function (err, results) {
      if (err) {
        reject(err);
      } else {
        resolve({
          reviews: results,
          pageNumber: page,
          totalPages: lastPage,
          pageSize: numPerPage,
          totalCount: totalCount
        });
      }
    });
  });
}

router.get('/', function (req, res) {
  const mysqlPool = req.app.locals.mysqlPool;
  getReviewCount(mysqlPool)
    .then((count) => {
      return getReviewsPage(parseInt(req.query.page) || 1, count, mysqlPool);
    })
    .then((reviewsPageInfo) => {
      reviewsPageInfo.links = {};
      let { links, pageNumber, totalPages } = reviewsPageInfo;
      if (pageNumber < totalPages) {
        links.nextPage = '/reviews?page=' + (pageNumber + 1);
        links.lastPage = '/reviews?page=' + totalPages;
      }
      if (pageNumber > 1) {
        links.prevPage = '/reviews?page=' + (pageNumber - 1);
        links.firstPage = '/reviews?page=1';
      }
      res.status(200).json(reviewsPageInfo);
    })
    .catch((err) => {
      res.status(500).json({
        error: "Error fetching reviews list.  Please try again later."
      });
    });
});

function insertNewReview(review, mysqlPool, mongoDB) {
  return new Promise((resolve, reject) => {
    const reviewValues = {
      id: null,
      recipeID: review.recipeID,
      userID: review.userID,
      title: review.title,
      rating: review.rating,
      review: review.review
    };
    mysqlPool.query(
      'INSERT INTO reviews SET ?',
      reviewValues,
      function (err, result) {
        if (err) {
          reject(err);
        } else {
          resolve(result.insertId);
        }
      }
    );
  }).then((id) => {
    return addReviewToUser(id, review.userID, mongoDB);
  });
}

router.post('/', function (req, res, next) {
  const mysqlPool = req.app.locals.mysqlPool;
  const mongoDB = req.app.locals.mongoDB;
  if (validateReviewObject(req.body)) {
    getUserByID(req.body.userID, mongoDB)
      .then((user) => {
        if (user) {
          return insertNewReview(req.body, mysqlPool, mongoDB);
        } else {
          return Promise.reject(400);
        }
      })
      .then((id) => {
        res.status(201).json({
          id: id,
          links: {
            review: `/reviews/${id}`
          }
        });
      })
      .catch((err) => {
        if (err === 400) {
          res.status(400).json({
            error: `Invalid owner ID: ${req.body.userID}.`
          });
        } else {
          res.status(500).json({
            error: "Error inserting review into DB.  Please try again later."
          });
        }
      });
  } else {
    res.status(400).json({
      error: "Request needs a JSON body with a name, a price, and an owner ID"
    });
  }

});

function getReviewByRecipeID(recipeID, mysqlPool) {
  return new Promise((resolve, reject) => {
    mysqlPool.query('SELECT * FROM reviews WHERE recipeID = ?', [ recipeID ], function (err, results) {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  });
}

router.get('/:recipeID', function (req, res, next) {
  const mysqlPool = req.app.locals.mysqlPool;
  const recipeID = parseInt(req.params.recipeID);
  getReviewByRecipeID(recipeID, mysqlPool)
    .then((review) => {
      if (review) {
        res.status(200).json(review);
      } else {
        next();
      }
    })
    .catch((err) => {
      res.status(500).json({
        error: "Unable to fetch review."
      });
    });
});

function updateReviewByID(reviewID, review, mysqlPool) {
  return new Promise((resolve, reject) => {
    const reviewValues = {
      recipeID: review.recipeID,
      userID: review.userID,
      title: review.title,
      rating: review.rating,
      review: review.review
    };
    mysqlPool.query('UPDATE reviews SET ? WHERE id = ?', [ reviewValues, reviewID ], function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result.affectedRows > 0);
      }
    });
  });
}

router.put('/:reviewID', function (req, res, next) {
  const mysqlPool = req.app.locals.mysqlPool;

  const reviewID = parseInt(req.params.reviewID);
  if (validateReviewObject(req.body)) {
    updateReviewByID(reviewID, req.body, mysqlPool)
      .then((updateSuccessful) => {
        if (updateSuccessful) {
          res.status(200).json({
            links: {
              review: `/reviews/${reviewID}`
            }
          });
        } else {
          next();
        }
      })
      .catch((err) => {
        res.status(500).json({
          error: "Unable to update review."
        });
      });
  } else {
    res.status(400).json({
      err: "Request needs a JSON body with a name, a price, and an owner ID"
    });
  }

});

function deleteReviewByID(reviewID, mysqlPool) {
  return new Promise((resolve, reject) => {
    mysqlPool.query('DELETE FROM reviews WHERE id = ?', [ reviewID ], function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result.affectedRows > 0);
      }
    });
  });

}

router.delete('/:reviewID', function (req, res, next) {
  const mysqlPool = req.app.locals.mysqlPool;
  const reviewID = parseInt(req.params.reviewID);
  deleteReviewByID(reviewID, mysqlPool)
    .then((deleteSuccessful) => {
      if (deleteSuccessful) {
        res.status(204).end();
      } else {
        next();
      }
    })
    .catch((err) => {
      res.status(500).json({
        error: "Unable to delete review."
      });
    });
});

exports.router = router;