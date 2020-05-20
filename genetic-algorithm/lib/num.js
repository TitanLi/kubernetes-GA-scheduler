// 解決javascript float問題
// 0.1 + 0.2 = 0.30000000000000004
const strip = function (num, precision = 10) {
    return Number(num.toFixed(precision));
}

module.exports = {
    strip
}