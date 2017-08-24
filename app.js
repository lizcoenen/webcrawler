// Backend developed by James Stewart

var request = require('request');
var cheerio = require('cheerio');
var express = require('express');
var bodyParser  = require('body-parser');
var multipart = require('connect-multiparty');
var http = require('http');
var handlebars = require('express-handlebars').create({defaultLayout:'main'});
var fs = require('fs');
var app = express();
var multipartMiddleware = multipart();
var filePath = './public/temp.json';
var visited = [];
var keys = [];
var first;
var starturl;
var depth;
var interval;
var keyword;
var keywordFound;
var maxurls;

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
//app.set('port',7219)

// process.env.PORT lets the port be set by Heroku
var port = process.env.PORT || 8080;
app.set('port', port);

app.use(function (req, res, next) {
  // Website sending requests</code>
  res.setHeader('Access-Control-Allow-Origin', 'http://web.engr.oregonstate.edu');
  // Request method that you are allowing
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST');
  // Request header types that are allowed
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  // The following is set to false since we won't be addressing cookies and sessions
  res.setHeader('Access-Control-Allow-Credentials', false);
  // Proceed to the next layer of middleware
  next();
});

// set directory for saving log file
app.use(express.static('./public'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
// required to read POST data from form submission
app.use('/post', multipartMiddleware);

// renders home page
app.get('/', function(req,res){
  // clears log file
  fs.writeFile(filePath, '', 'utf8', function(err) {
    if(err) {
      return console.log(err);
    };
});
  res.render('home');
});

// processes POST data from form submission
app.post('/post', function(req,res){
  // sets starting url
  starturl = req.body.url;
  // sets depth
  depth = req.body.steps;  
  // sets maxurls and waiting interval based on depth level
  if (depth == 1) {
	maxurls = 100;
    interval = 1000;
  } else if (depth == 2) {
	maxurls = 25;
    interval = 6000;
  } else {
	maxurls = 10;
	interval = 18000;
  };
  // sets keyword if entered
  keyword = req.body.keyword;
  keywordFound = false;
  first = true;
  visited = [];
  keys = [];
  // starts web crawler with starting url
  crawler(starturl);
  setTimeout(function() {
    res.render('home');
  }, interval); 
});

// renders 404 error page
app.use(function(req,res){
  res.status(404);
  res.render('404');
});

// renders 500 error page
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.type('plain/text');
  res.status(500);
  res.render('500');
});

// initiates Node.js server on specified port
app.listen(app.get('port'), function(){
  console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.');
});

function crawler(url) {
  // uses request to visit specified url
  request(url, function (err, res, html) {
	// proceeds if no errors encountered
    if (!err && res.statusCode == 200) {
	  // utilizes cheerio framework to parse html
      var $ = cheerio.load(html);
	  // creates object for url and parsed links array
	  var obj = {
        baseurl: url,
        links: []
	  };
	  var duplicate = false;
	  
	  // iterates through div elements
	  $('div').each(function(){
		// if keywork supplied and not found yet proceed
		if (keyword != '' && keywordFound === false) {
		  var text = $(this).text();
		  // check if keyword in div element
		  if (text.match(keyword)) {
			// output keyword found message in console
			console.log('\nKeyword \"' + keyword + '\" found at ' + url + '. Terminating crawler!\n');
			keywordFound = true;
			// push keyword url to links array
			obj.links.push({name: 'keywordFound', url: url});
			// push keyword object to visited array
			visited.push(obj);
			// encode visited array in JSON format
			var json = JSON.stringify(visited);
			// create JSON log file
			fs.writeFile(filePath, json, 'utf8', function(err) {
			  if(err) {
				return console.log(err);
			  };
			});
		  };
		};
	  });
	  
	  // proceed if keyword not found or supplied
	  if (keywordFound === false) {
		// iterate through a elements
	    $('a').each(function(){
		  // parse url text and link
	      var text = $(this).text();
	      var link = $(this).attr('href');
		  // parse only non-blank, non-relative, non-image, non-tabbed links up to the maximum per page
	      if(text && link && link.match('http://') 
			  && !text.match('img') && !text.match('\n') && !text.match('\t') && obj.links.length < maxurls) {
		    // remove fragment & query strings
			link = link.split('?')[0].split("#")[0];
			// remove trailing backslashes
		    link = link.replace(/\/$/, "");
			// push name and url to links array
		    obj.links.push({name: text, url: link});
	      };
        });
	    // check keys to see if url is already visited
        for(var i = 0; i < keys.length; i++) {
          if (keys[i] === obj.baseurl) {
		    duplicate = true;
		    console.log('Skipped duplicate ' + obj.baseurl);
	      };
        };
		// save unique url only if there are parsed links or it is the root base url
	    if (duplicate === false && obj.links.length > 0 || first === true) {
		  // push url object to visited array
		  visited.push(obj);
		  // push url to keys array
		  keys.push(obj.baseurl);
		  // encode visited array in JSON format
	      var json = JSON.stringify(visited);
		  // create JSON log file
	      fs.writeFile(filePath, json, 'utf8', function(err) {
            if(err) {
              return console.log(err);
            };
            console.log('Added ' + obj.baseurl);
	      });
        };
		// proceed if first pass and depth higher than 1
	    if (depth > 1 && first === true) {
		  first = false;
		  // call secondLayer function with time out to allow recursive call
		  secondLayer(setTimeout(function(err) {
		    if(err) {
			  return console.log(err);
		    };
			// proceed if 3 layers requested
		    if (depth == 3) {
			  // recursively call crawler function for each base url parsed from secondLayer function
		      for (var i = 1; i < visited.length; i++) {
                for (var j = 0; j < visited[i].links.length; j++) {
	              var baseurl = visited[i].links[j].url;
	              crawler(baseurl);
		        };
	          };
		    };
		  }, 7000));
	    };
	  };
    };
  });
};

// recursive function for multi-level crawl
function secondLayer(next) {
  // visit each link parsed from root base url
  for (var i = 0; i < visited[0].links.length; i++) {
	var baseurl = visited[0].links[i].url;
	crawler(baseurl);
  };
};