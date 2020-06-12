const {arraySum} = require('./../../genetic-algorithm/lib/array.js');
let spec = 35;
let vnf = [];
for (let i = 0; i<10; i ++) {
    vnf.push(Number(Math.floor(Math.random() * 6))+1);
}
console.log(vnf);
console.log(arraySum(vnf));