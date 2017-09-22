const downloader = require('image-downloader');
const path = require('path');

const download = (url) => {
    return new Promise((resolve, reject) => {
        const options = {
            url,
            dest: path.join(path.resolve(__dirname), '..', 'public/user_images/landmark_recognizer/image.png')
        }

        downloader.image(options)
            .then(({ filename }) => {
                resolve(filename);
            }).catch((err) => {
                throw err
            });
    })
}

module.exports = {
    download
};