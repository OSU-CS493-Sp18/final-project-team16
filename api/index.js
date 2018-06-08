const router = module.exports = require('express').Router();

router.use('/recipes', require('./recipes').router);
router.use('/reviews', require('./reviews').router);
router.use('/users', require('./users').router);