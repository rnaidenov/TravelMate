const request = require('request');
const config = require('./config');

function getWikipediaArticle(landmark) {
    const reqUrl = `https://www.googleapis.com/customsearch/v1?key=${config.googleCSEAPIKey}&cx=${config.googleCSE}&q=${landmark}`;
    return new Promise((resolve, reject) => {
        request.get(reqUrl, (err, res, body) => {
            
            console.log(res);
        })
        // fetch(reqUrl).then(response => {
        //     response.json().then(results => {
        //         if (results.items) {
        //             console.log(results.items[0].link);
        //         }
        //     })
        // })
    })
};

getWikipediaArticle('Alexander Nevsky Cathedral').then ;


module.exports = {
    getWikipediaArticle
}
