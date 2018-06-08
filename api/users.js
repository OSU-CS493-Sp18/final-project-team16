const router = require('express').Router();

router.get('/', function (req, res) {
  res.status(200).json({
	 "Hello welcome to my route" 
  });
});

exports.router = router;