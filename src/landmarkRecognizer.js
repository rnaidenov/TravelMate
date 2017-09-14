const cloudVisionApiKey = "AIzaSyBTUkHUMb0vrt7xgt6IbWyrH-A3LTA_3jI";
const cloudVisionUrl = "https://vision.googleapis.com/v1/images:annotate?key="
const download = require('image-downloader');
const Vision = require('@google-cloud/vision');
const path = require('path');
const vision = Vision();
const request = require('request');
const http = require('http');
const smmryApiKey = '4101146502';

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
        request.get(_generateSearchQuery(landmark), (err, res, body) => {
            const { "sm_api_content": summary } = JSON.parse(body);
            const sentences = summary.split('.');
            resolve(sentences);
        });
    })
}

function _generateSearchQuery(landmark) {
    const wikipedia_base_url = 'https://en.wikipedia.org/wiki/';
    const smmry_base_url = 'http://api.smmry.com';
    const numSentences = 9;

    return `${smmry_base_url}/&SM_API_KEY=${smmryApiKey}&SM_LENGTH=${numSentences}&SM_URL=${wikipedia_base_url}${landmark}`;
}


// summarizeArticle("Vasil Levski National Stadium").then(facts => {
//     facts.forEach((fact,idx) => {
//         console.log(fact);
//     })
// });

module.exports = {
    recognize,
    getWebEntities,
    summarizeArticle
}