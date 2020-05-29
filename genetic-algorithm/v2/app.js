const colors = require('colors');
const { threeDimensionalArraySortByFirstElement, arrayFind } = require('../lib/array.js');
const Placement = require('./placement.js');

class GA {
    constructor(initPopulationSize, clusterWorkNodeMaster, gaWorkNodeName) {
        // this.deploymentList = deploymentList;
        this.initPopulationSize = initPopulationSize;
        this.clusterWorkNodeMaster = clusterWorkNodeMaster;
        this.gaWorkNodeName = gaWorkNodeName;
        this.clusterWorkNodeMasterNum = gaWorkNodeName.indexOf(clusterWorkNodeMaster);
    }
    copulation(workNodeResource, vnfNameList, vnfRequestsResource, currentPodPlacement = [[]], maybeTurnOffNodeNum = 0) {
        let ga = new Placement(this.clusterWorkNodeMasterNum, workNodeResource, vnfRequestsResource, this.initPopulationSize, currentPodPlacement, maybeTurnOffNodeNum);
        // 產生初始化基因池
        let initPopulationResult = ga.initPopulation();
        if (initPopulationResult) {
            console.log(colors.red('可成功調度'));
            console.log(vnfNameList);
            let populationScore = ga.getScore(initPopulationResult);
            console.log('初始化基因');
            console.log(populationScore.sort(threeDimensionalArraySortByFirstElement));
            let copulationResult;
            let mutationResult;
            let copulationSuccess = 0;
            let mutationSuccess = 0;
            for (let i = 0; i < 10000; i++) {
                copulationResult = ga.copulation(populationScore);
                if (copulationResult) {
                    populationScore = copulationResult;
                    copulationSuccess++;
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
                } else {
                    i--;
                }
            }
            console.log(colors.green("基因演算法執行成功"));
            console.log(`copulation次數：${copulationSuccess}`);
            console.log(`mutation次數：${mutationSuccess}`);
            console.log(populationScore.sort(threeDimensionalArraySortByFirstElement));

            return populationScore;
        } else {
            return false;
        }
    }
}
module.exports = GA;