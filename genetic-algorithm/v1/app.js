const { threeDimensionalArraySortByFirstElement, threeDimensionalArrayCopy } = require('./../lib/array.js');
const GA = require('./placement.js');
const compute = [2, 4, 4, 4, 6, 8, 10, 12];
// [ 10 ], [], [], [], [], [ 6 ], [], [], [], [ 2, 3, 5 ], [ 2, 4, 6 ] 
const vnf = [2, 2, 3, 4, 5, 6, 6, 2, 2, 4, 4, 3, 3, 2, 2];
const initPopulationSize = 10;
const ga = new GA(compute, vnf, initPopulationSize);

async function test() {
    // 產生初始化基因池
    let initPopulationResult = ga.initPopulation();
    let populationScore = ga.getScore(initPopulationResult);
    console.log('初始化基因');
    console.log(populationScore.sort(threeDimensionalArraySortByFirstElement));
    // 交配
    for (let i = 0; i < 10000; i++) {
        copulationResult = ga.copulation(populationScore);
        if (copulationResult) {
            populationScore = copulationResult
        } else {
            i--;
        }
        // 變異
        if (Math.floor(Math.random() * 100) < 10) {
            mutationResult = ga.mutation(populationScore);
            if (mutationResult) {
                populationScore = mutationResult;
            } else {
                i--;
            }
        }
    }
    // populationScore = ga.mutation(populationScore);
    console.log(populationScore.sort(threeDimensionalArraySortByFirstElement));
}

test();