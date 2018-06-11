const router = require('express').Router();
const { addRecipeToUser, getUserByID } = require('./users');

function validateRecipeObject(recipe) {
  return recipe && recipe.userID && recipe.title && recipe.description && recipe.steps;
}

function getRecipeCount(mysqlPool) {
  return new Promise((resolve, reject) => {
    mysqlPool.query('SELECT COUNT(*) AS count FROM recipes', function (err, results) {
      if (err) {
        reject(err);
      } else {
        resolve(results[0].count);
      }
    });
  });
}

function getRecipesPage(page, totalCount, mysqlPool) {
  return new Promise((resolve, reject) => {
    const numPerPage = 10;
    const lastPage = Math.ceil(totalCount / numPerPage);
    page = page < 1 ? 1 : page;
    page = page > lastPage ? lastPage : page;
    const offset = (page - 1) * numPerPage;
    mysqlPool.query('SELECT * FROM recipes ORDER BY id LIMIT ?,?', [offset, numPerPage], function (err, results) {
      if (err) {
        reject(err);
      } else {
        resolve({
          recipes: results,
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
  getRecipeCount(mysqlPool)
    .then((count) => {
      return getRecipesPage(parseInt(req.query.page) || 1, count, mysqlPool);
    })
    .then((recipesPageInfo) => {
      recipesPageInfo.links = {};
      let { links, pageNumber, totalPages } = recipesPageInfo;
      if (pageNumber < totalPages) {
        links.nextPage = '/recipes?page=' + (pageNumber + 1);
        links.lastPage = '/recipes?page=' + totalPages;
      }
      if (pageNumber > 1) {
        links.prevPage = '/recipes?page=' + (pageNumber - 1);
        links.firstPage = '/recipes?page=1';
      }
      res.status(200).json(recipesPageInfo);
    })
    .catch((err) => {
      res.status(500).json({
        error: "Error fetching recipes list.  Please try again later."
      });
    });
});

function insertNewRecipe(recipe, mysqlPool, mongoDB) {
  return new Promise((resolve, reject) => {
    const recipeValues = {
      id: null,
      userID: recipe.userID,
	  title: recipe.title,
      description: recipe.description,
      steps: recipe.steps
    };
    mysqlPool.query(
      'INSERT INTO recipes SET ?',
      recipeValues,
      function (err, result) {
        if (err) {
          reject(err);
        } else {
          resolve(result.insertId);
        }
      }
    );
  }).then((id) => {
    return addRecipeToUser(id, recipe.userID, mongoDB);
  });
}

router.post('/', function (req, res, next) {
  const mysqlPool = req.app.locals.mysqlPool;
  const mongoDB = req.app.locals.mongoDB;
  if (validateRecipeObject(req.body)) {
    getUserByID(req.body.userID, mongoDB)
      .then((user) => {
        if (user) {
          return insertNewRecipe(req.body, mysqlPool, mongoDB);
        } else {
          return Promise.reject(400);
        }
      })
      .then((id) => {
        res.status(201).json({
          id: id,
          links: {
            recipe: `/recipes/${id}`
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
            error: "Error inserting recipe into DB.  Please try again later."
          });
        }
      });
  } else {
    res.status(400).json({
      error: "Request needs a JSON body with a name, a price, and an owner ID"
    });
  }

});

function getRecipeByID(recipeID, mysqlPool) {
  return new Promise((resolve, reject) => {
    mysqlPool.query('SELECT * FROM recipes WHERE id = ?', [ recipeID ], function (err, results) {
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
  getrecipeByID(recipeID, mysqlPool)
    .then((recipe) => {
      if (recipe) {
        res.status(200).json(recipe);
      } else {
        next();
      }
    })
    .catch((err) => {
      res.status(500).json({
        error: "Unable to fetch recipe."
      });
    });
});

function updateRecipeByID(recipeID, recipe, mysqlPool) {
  return new Promise((resolve, reject) => {
    const recipeValues = {
      userID: recipe.userID,
	  title: recipe.title,
      description: recipe.description,
      steps: recipe.steps
    };
    mysqlPool.query('UPDATE recipes SET ? WHERE id = ?', [ recipeValues, recipeID ], function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result.affectedRows > 0);
      }
    });
  });
}

router.put('/:recipeID', function (req, res, next) {
  const mysqlPool = req.app.locals.mysqlPool;

  const recipeID = parseInt(req.params.recipeID);
  if (validateRecipeObject(req.body)) {
    updateRecipeByID(recipeID, req.body, mysqlPool)
      .then((updateSuccessful) => {
        if (updateSuccessful) {
          res.status(200).json({
            links: {
              recipe: `/recipes/${recipeID}`
            }
          });
        } else {
          next();
        }
      })
      .catch((err) => {
        res.status(500).json({
          error: "Unable to update recipe."
        });
      });
  } else {
    res.status(400).json({
      err: "Request needs a JSON body with a name, a price, and an owner ID"
    });
  }

});

function deleteRecipeByID(recipeID, mysqlPool) {
  return new Promise((resolve, reject) => {
    mysqlPool.query('DELETE FROM recipes WHERE id = ?', [ recipeID ], function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result.affectedRows > 0);
      }
    });
  });

}

router.delete('/:recipeID', function (req, res, next) {
  const mysqlPool = req.app.locals.mysqlPool;
  const recipeID = parseInt(req.params.recipeID);
  deleteRecipeByID(recipeID, mysqlPool)
    .then((deleteSuccessful) => {
      if (deleteSuccessful) {
        res.status(204).end();
      } else {
        next();
      }
    })
    .catch((err) => {
      res.status(500).json({
        error: "Unable to delete recipe."
      });
    });
});

exports.router = router;