const request = require('request');
const config = require('./config');

function getWikipediaLink(landmark) {
    const reqUrl = `https://www.googleapis.com/customsearch/v1?key=${config.googleCSEAPIKey}&cx=${config.googleCSE}&q=${landmark}`;
    return new Promise((resolve, reject) => {
        request.get(reqUrl, (err, res, body) => {
            const googleResults = JSON.parse(body);
            // First wikipedia link
            resolve(googleResults.items[0].link);
        })
    })
};

module.exports = {
    getWikipediaLink
}
