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
    [8,16],
    [8,16],
    [8,16],
    [8,16],
    [8,16]
]

// const compute = [
//     [4,8],
//     [4,8],
//     [8,10],
//     [8,16],
// ]

const vnf = [
    [2, 2],
    [2, 3],
    [4, 4],
    [4, 6],
    [5, 5],
    [4, 6]
];
// [ 27.48 ], [], [], [], [], [], [ 2, 5 ], [ 1, 3, 4 ], [] ] 
// const vnf = [
//     [1,2],
//     [1,2],
//     [1,1],
//     [1,2],
//     [1,4],
//     [2,2],
//     [1,2]
// ]
const initPopulationSize = 10;
const ga = new GA(compute, vnf, initPopulationSize);

async function test() {
    // 產生初始化基因池
    let initPopulationResult = ga.initPopulation();
    let populationScore = ga.getScore(initPopulationResult);
    console.log('初始化基因');
    console.log(populationScore.sort(threeDimensionalArraySortByFirstElement));
    // populationScore[9] = [[ 27.04 ], [], [], [], [], [], [ 2, 5 ], [], [ 3, 4, 1 ]] ;
    // console.log(populationScore[9]);
    let copulationSuccess = 0;
    let mutationSuccess = 0;
    for (let i = 0; i < 10000; i++) {
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
    }
    console.log(color.green("基因演算法執行成功"));
    console.log(`copulation次數：${copulationSuccess}`);
    console.log(`mutation次數：${mutationSuccess}`);
    console.log(copulationResult.sort(threeDimensionalArraySortByFirstElement));
}

test();