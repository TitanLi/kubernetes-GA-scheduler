const colors = require('colors');
const { threeDimensionalArraySortByFirstElement, arrayFind } = require('../lib/array.js');
const Placement = require('./placement.js');

class GA {
    constructor(initPopulationSize, clusterMasterWorkNode, gaWorkNodeName) {
        // this.deploymentList = deploymentList;
        // 人口集合大小
        this.initPopulationSize = initPopulationSize;
        // 叢集Master Node
        this.clusterMasterWorkNode = clusterMasterWorkNode;
        // 叢集Worker Node列表
        this.gaWorkNodeName = gaWorkNodeName;
        // 取得Master Node編號
        this.clusterMasterWorkNodeNum = gaWorkNodeName.indexOf(clusterMasterWorkNode);
    }
    /**
     * 
     * 放置決策模組
     * 
     * @param {Array} workNodeResource 
     * @param {Array} vnfNameList 
     * @param {Array} vnfRequestsResource 
     * @param {Array} currentPodPlacement 
     * @param {Number} maybeTurnOffNodeNum 
     */
    copulation(workNodeResource, vnfNameList, vnfRequestsResource, currentPodPlacement = [[]], maybeTurnOffNodeNum = undefined) {
        let ga = new Placement(this.clusterMasterWorkNodeNum, workNodeResource, vnfRequestsResource, this.initPopulationSize, currentPodPlacement, maybeTurnOffNodeNum);
        // 產生初始化染色體集合
        let initPopulationResult = ga.initPopulation();
        // 如果初始化染色體成功
        if (initPopulationResult) {
            console.log(colors.red('可成功調度的VNF'));
            console.log(vnfNameList);
            // 產生人口染色體母體集合，並對初始化染色體集合評分
            let population = ga.getScore(initPopulationResult);
            console.log('初始化基因');
            console.log(population.sort(threeDimensionalArraySortByFirstElement));
            // 交配結果
            let copulationResult;
            // 突變結果
            let mutationResult;
            // 交配次數
            let copulationSuccess = 0;
            // 突變次數
            let mutationSuccess = 0;
            for (let i = 0; i < 1000; i++) {
                // 染色體交配
                copulationResult = ga.copulation(population);
                // 如果成功交配
                if (copulationResult) {
                    // 更新染色體母體集合
                    population = copulationResult;
                    // 計算交配次數
                    copulationSuccess++;
                    // 突變
                    if (Math.floor(Math.random() * 100) < 10) {
                        mutationResult = ga.mutation(population);
                        // 如果突變成功
                        if (mutationResult) {
                            // 更新染色體母體集合
                            population = mutationResult;
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
            console.log(population.sort(threeDimensionalArraySortByFirstElement));
            return population;
        } else {
            return false;
        }
    }
}
module.exports = GA;