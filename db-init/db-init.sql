USE recipes;

DROP TABLE IF EXISTS `recipes`;
DROP TABLE IF EXISTS `reviews`;

CREATE TABLE `recipes` (
  `id` MEDIUMINT NOT NULL AUTO_INCREMENT,
  `userID` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `steps` TEXT NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `reviews` (
  `id` MEDIUMINT NOT NULL AUTO_INCREMENT,
  `recipeID` MEDIUMINT NOT NULL,
  `userID` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `rating` VARCHAR(255) NOT NULL,
  `review` text,
  PRIMARY KEY (`id`),
  FOREIGN KEY (recipeID) REFERENCES recipes(id)
);