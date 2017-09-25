const Translate = require('@google-cloud/translate');
const translate = Translate();
const Vision = require('@google-cloud/vision');
const ImageDownloader = require('./imageDownloader');
const vision = Vision();


const considerTranslation = (article, targetLanguage) => {
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

const detectText = (url) => {
    return new Promise((resolve, reject) => {
        ImageDownloader.download(url).then(filename => {
            vision.textDetection({ source: { filename } })
                .then((results) => {
                    const detectedText = results[0].textAnnotations[0].description;
                    // Newline to match format of image
                    const textWithNewLines = detectedText.replace(/\n/g,'\n \n');
                    resolve(textWithNewLines);
                })
                .catch((err) => {
                    console.error('ERROR:', err);
                });
        })
    });
}




const detectLanguage = (text) => {
    return new Promise((resolve, reject) => {
        translate.detect(text)
            .then(detectedLanguage => {
                const { language } = detectedLanguage[0];
                resolve(language);
            })
            .catch((err) => {
                console.error('Unable to detect language.', err);
            });
    })
}


const translateArticle = (article, targetLanguage) => {
    return new Promise((resolve, reject) => {
        const target = targetLanguage;
        translate.translate(article, target)
            .then(translatedArticle => {
                resolve(translatedArticle[0]);
            })
            .catch((err) => {
                console.error('Failed to translate article.', err);
            });
    });
}

module.exports = {
    considerTranslation,
    detectText
}