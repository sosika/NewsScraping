// Dependencies
var express = require("express");
var mongojs = require("mongojs");
var request = require("request");
var cheerio = require("cheerio");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");

// Initialize Express
var app = express();

// Require all models
var db = require("./models");

// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: false }));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));

// Set mongoose to leverage built in JavaScript ES6 Promises
// Connect to the Mongo DB
mongoose.Promise = Promise;
// mongoose.connect("mongodb://localhost/news");

var databaseUri = 'mongodb://localhost/news';
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI);
} else {
  mongoose.connect(databaseUri);
}

// Routes

// Scrape data from news site and place it into the mongodb db
app.get("/scrape", function(req, res) {
  // Make a request for the news section of ycombinator
  request("https://www.dogonews.com/", function(error, response, html) {
    // Load the html body from request into cheerio
    var $ = cheerio.load(html);
    // For each element with a "post-news" class
    $(".post-news").each(function(i, element) {

      var url = $(element).find("a").attr("href");
      var title = $(element).find("a").find("span").text();
      var img = $(element).find("a").find("img").attr("src");
      var summary = $(element).find("p").text();

      // If this found all elements
      if (url && title && img && summary) {
        // Insert the data in the article db
        db.Article.create({
          url: "https://www.dogonews.com" + url,
          title: title.substring(3),
          img: img,
          summary: summary
        },
        function(err, inserted) {
          if (err) {
            // Log the error if one is encountered during the query
            console.log(err);
          }
          else {
            // Otherwise, log the inserted data
            console.log(inserted);
          }
        });
      }
    });
  });
  // Send a "Scrape Complete" message to the browser
  res.send("Scrape Complete");
});

// Retrieve data from the db
app.get("/articles", function(req, res) {
  // Find all results from the article collection in the db
  db.Article
    .find({})
    .then(function(dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article
    .findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function(dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note
    .create(req.body)
    .then(function(dbNote) {
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

app.get("/delete/:id", function(req, res) {
  // Remove a note using the objectID
  db.Article.update(
    {  _id: req.params.id },
    { $unset: {note: "" }})
  .then(function(error, removed) {
    // Log any errors from mongojs
    if (error) {
      console.log(error);
      res.send(error);
    }
    // Otherwise, send the mongojs response to the browser
    else {
      console.log(removed);
      res.send(removed);
    }
  });
});

// Listen on port 3000
app.listen(3000, function() {
  console.log("App running on port 3000!");
});
