const config = require('./config');
const cloudVisionUrl = "https://vision.googleapis.com/v1/images:annotate?key=";
const ArticleFinder = require('./articleFinder');
const download = require('image-downloader');
const Vision = require('@google-cloud/vision');
const path = require('path');
const vision = Vision();
const request = require('request');
const http = require('http');

function recognize(url) {
    return new Promise((resolve, reject) => {
        _downloadImage(url).then(filename => {
            _detect(filename).then(res => {
                resolve(res);
            });
        })
    })
}

function getWebEntities(url) {
    return new Promise((resolve, reject) => {
        _downloadImage(url).then(filename => {
            _getWebResults(filename).then(res => {
                resolve(res);
            });
        })
    })
}

getWebEntities("http://www.sofia-guide.com/assets/vasil_levski_stadium_above.jpg").then(res => {
    console.log(res);
})

function _downloadImage(url) {
    return new Promise((resolve, reject) => {
        const options = {
            url,
            dest: path.join(path.resolve(__dirname), '..', 'public/user_images/landmark_recognizer/image.png')
        }

        download.image(options)
            .then(({ filename }) => {
                resolve(filename);
            }).catch((err) => {
                throw err
            });
    })
}


function _detect(filename) {
    return new Promise((resolve, reject) => {

        vision.landmarkDetection({ source: { filename } })
            .then((results) => {
                const landmarks = results[0].landmarkAnnotations;
                if (landmarks.length) {
                    resolve(landmarks[0].description);
                } else {
                    resolve(null);
                }
            })
            .catch((err) => {
                console.error('ERROR:', err);
            });
    })
}




function _getWebResults(filename) {
    return new Promise((resolve, reject) => {
        vision.webDetection({ source: { filename } })
            .then((results) => {
                const webEntities = results[0].webDetection.webEntities;
                const resolvedEntities = [];

                if (webEntities.length) {
                    webEntities.forEach(webEntity => {
                        const { score, description } = webEntity;
                        if (score > 7.0) {
                            resolvedEntities.push(description);
                        }
                    })
                }
                resolve(resolvedEntities);
            })
            .catch((err) => {
                console.error('ERROR:', err);
            });
    });
}

function summarizeArticle(landmark) {
    return new Promise((resolve, reject) => {
        _generateSearchUrl(landmark).then(url => {
            request.get(url, (err, res, body) => {
                const { "sm_api_content": summary } = JSON.parse(body);
                const sentences = summary.split('[BREAK]');
                sentences.pop();
                resolve(sentences);
            });
        });
    })
}

function _generateSearchUrl(landmark) {

    const smmry_base_url = 'http://api.smmry.com';
    const numSentences = 10;

    return new Promise ((resolve,reject) => {
        ArticleFinder.getWikipediaLink(landmark).then(link => {
            resolve(`${smmry_base_url}/&SM_API_KEY=${config.smmryApiKey}&SM_LENGTH=${numSentences}&SM_WITH_BREAK&SM_URL=${link}`)
        })
    });
}

module.exports = {
    recognize,
    getWebEntities,
    summarizeArticle
}