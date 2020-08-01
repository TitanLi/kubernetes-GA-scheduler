const sleep = function (t) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, t);
    });
}

module.exports = {
    'sleep': sleep
};