const request = require('request');
const config = require('./config');
const translate = require('google-translate-api');
const FactFinder = require('./factFinder');

function considerTranslation(article, targetLanguage) {
    return new Promise((resolve, reject) => {
        detectLanguage(article[0]).then(articleLanguage => {
            if (articleLanguage != targetLanguage) {
                translateArticle(article, targetLanguage).then(translation => {
                    resolve({
                        isTranslated: true,
                        translation
                    });
                });
            } else {
                resolve({ isTranslated: false });
            }
        });
    });
}


const detectLanguage = (text) => {
    return new Promise((resolve, reject) => {
        const LANG_DETECTION_URL = `http://apilayer.net/api/detect?access_key=7caf7f28a83031df5f520981a3b27310&query=${encodeURIComponent(text)}`;

        request.get(LANG_DETECTION_URL, (err, res, body) => {
            const detectionResults = JSON.parse(body);
            resolve(detectionResults.results[0].language_code);
        });
    });
}

const translateArticle = (article,targetLanguage) => {
    return new Promise((resolve,reject) => {
        const translatedArticle = [];
        article.forEach(fact => {
            translatedArticle.push(_translateSentence(fact));
        })
    
        Promise.all(translatedArticle).then(translatedFacts => {
            resolve(translatedFacts);
        });
    })
}

const _translateSentence = (sentence,targetLanguage) => {
    return new Promise((resolve, reject) => {
        translate(sentence, { to: targetLanguage }).then(translation => {
            resolve(translation.text);
        });
    });
}

module.exports = {
    considerTranslation
}