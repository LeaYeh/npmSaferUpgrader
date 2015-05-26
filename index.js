var request = require('request');

console.log('test publishing module.');
module.exports = function() {
    //console.log('practice publishing npm module.');
    request('http://www.google.com', function (error, response, body) {
        if (!error && response.statusCode == 200) {
             console.log(body) // Show the HTML for the Google homepage.
        }
    })

}

