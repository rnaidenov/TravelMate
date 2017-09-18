const request = require('request');
const config = require('./config');
const Translator = require('./translator');

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


function summarizeArticle(landmark, targetLanguage) {
    return new Promise((resolve, reject) => {
        _generateSearchUrl(landmark).then(url => {
            request.get(url, (err, res, body) => {
                const { "sm_api_content": summary } = JSON.parse(body);
                const article = summary.split('[BREAK]');
                article.pop();

                Translator.considerTranslation(article, targetLanguage).then(resolvedArticle => {
                    if (resolvedArticle.isTranslated) {
                        resolve(resolvedArticle.translation);
                    } else {
                        resolve(article);
                    }
                });
            });
        });
    })
}



function _generateSearchUrl(landmark) {

    const smmry_base_url = 'http://api.smmry.com';
    const numSentences = 10;

    return new Promise((resolve, reject) => {
        getWikipediaLink(landmark).then(link => {
            resolve(`${smmry_base_url}/&SM_API_KEY=${config.smmryApiKey}&SM_LENGTH=${numSentences}&SM_WITH_BREAK&SM_URL=${link}`)
        })
    });
}


module.exports = {
    summarizeArticle
}