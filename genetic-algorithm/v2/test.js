const color = require('colors');
const { threeDimensionalArraySortByFirstElement } = require('../lib/array.js');
const GA = require('./placement.js');
// const compute = [
//     [2, 4],
//     [4, 4],
//     [4, 8],
//     [4, 6],
//     [6, 12],
//     [8, 8],
//     [10, 20],
//     [12, 36]
// ];
const compute = [
    [8, 16],
    [8, 16],
    [8, 16],
    [8, 16],
    [8, 16]
]

// const compute = [
//     [7, 0],
//     [7, 0],
//     [7, 0],
//     [7,0],
//     [7, 0]
// ]

// const vnf = [
//     [1, 0],
//     [1, 0],
//     [2, 0],
//     [3, 0],
//     [3, 0],
//     [4, 0]
// ];
// [ 27.48 ], [], [], [], [], [], [ 2, 5 ], [ 1, 3, 4 ], [] ] 
const vnf = [
    [1, 2],
    [1, 2],
    [1, 1],
    [1, 2],
    [1, 4],
    [2, 2],
    [1, 2],
    [1, 2],
    [1, 4],
    [2, 2],
    [1, 2]
]
const initPopulationSize = 10;
// let a = 0;
// for (let i = 0; i < 1000; i++) {
//     const ga = new GA(0, compute, vnf, initPopulationSize, [[]]);
//     // const ga = new GA(0, compute, vnf, 10, [[]]);
//     let score;
//     let count = 0;
//     while (score != 6.8) {
//         let initPopulationResult = ga.initPopulation();
//         let populationScore = ga.getScore(initPopulationResult);
//         let test = populationScore.sort(threeDimensionalArraySortByFirstElement)
//         score = test[0][0][0];
//         count++;
//     }
//     console.log(i);
//     a = a + count;
// }
// console.log(a);


let avg = 0;
let count = 0;
async function test() {
    console.time('apple');
    const ga = new GA(0, compute, vnf, initPopulationSize, [[]]);
    // 產生初始化基因池
    let initPopulationResult = ga.initPopulation();
    let populationScore = ga.getScore(initPopulationResult);
    console.log('初始化基因');
    console.log(populationScore.sort(threeDimensionalArraySortByFirstElement));
    let copulationSuccess = 0;
    let mutationSuccess = 0;
    for (let i = 0; i < 1000; i++) {
        count++;
        copulationResult = ga.copulation(populationScore);
        if (copulationResult) {
            populationScore = copulationResult;
            copulationSuccess++;
        } else {
            i--;
        }
        // 變異
        if (Math.floor(Math.random() * 100) < 10) {
            mutationResult = ga.mutation(populationScore);
            if (mutationResult) {
                populationScore = mutationResult;
                mutationSuccess++;
            } else {
                i--;
            }
        }
        // let test = copulationResult.sort(threeDimensionalArraySortByFirstElement);
        // if (test[0][0][0] == 6.8) {
        //     i = 10000;
        //     console.log(count);
        //     avg = avg + count;
        // }
    }
    count = 0;
    console.log(color.green("基因演算法執行成功"));
    console.log(`copulation次數：${copulationSuccess}`);
    console.log(`mutation次數：${mutationSuccess}`);
    console.log(copulationResult.sort(threeDimensionalArraySortByFirstElement));
    console.timeEnd('apple');
}

// for (let i = 0; i < 1000; i++) {
    test();
// }
// console.log(avg);