const GA = require('./../../genetic-algorithm/v2/app.js');
let gaWorkNodeName = ['titan2','titan3','titan4','titan5','titan6'];
let workNodeResource = [[7,0],[7,0],[7,0],[7,0],[7,0]];
let vnfNameList = ['a1','a2','a3','a4','a5','a6','a7','a8','a9','a10'];
let vnfRequestsResource = [
    [4,0],
    [1,0],
    [2,0],
    [3,0],
    [2,0],
    [1,0],
    [1,0]
]
const ga = new GA(10,'titan2',gaWorkNodeName);
console.time('ga');
ga.copulation(workNodeResource, vnfNameList, vnfRequestsResource);
console.timeEnd('ga');