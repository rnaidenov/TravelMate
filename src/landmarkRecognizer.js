const config = require('./config');
const cloudVisionUrl = "https://vision.googleapis.com/v1/images:annotate?key=";
const FactFinder = require('./factFinder');
const ImageDownloader = require('./imageDownloader');
const Vision = require('@google-cloud/vision');
const vision = Vision();
const request = require('request');
const http = require('http');

const recognize = (url) => {
    return new Promise((resolve, reject) => {
        ImageDownloader.download(url).then(filename => {
            _detect(filename).then(res => {
                resolve(res);
            });
        })
    })
}

const getWebEntities = (url) => {
    return new Promise((resolve, reject) => {
        ImageDownloader.download(url).then(filename => {
            _getWebResults(filename).then(res => {
                resolve(res);
            });
        })
    })
}


const _detect = (filename) => {
    return new Promise((resolve, reject) => {

        vision.landmarkDetection({ source: { filename } })
            .then((results) => {
                const landmarks = results[0].landmarkAnnotations;
                console.log(landmarks)
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




const _getWebResults = (filename) => {
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

module.exports = {
    recognize,
    getWebEntities
}