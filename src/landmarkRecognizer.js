const config = require('./config');
const cloudVisionUrl = "https://vision.googleapis.com/v1/images:annotate?key=";
const FactFinder = require('./factFinder');
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

module.exports = {
    recognize,
    getWebEntities
}