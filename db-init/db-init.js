db.createUser({
  user: "recipe-db",
  pwd: "hunter2",
  roles: [ { role: "readWrite", db: "recipe-db" } ]
})

db.users.insertOne({
  userID: "luke",
  password: "pass123",
  bio: "",
  recipes [],
  reviews []
})