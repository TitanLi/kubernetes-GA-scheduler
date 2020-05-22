const colors = require('colors');
const { threeDimensionalArraySortByFirstElement, arrayFind } = require('../lib/array.js');
const Placement = require('./placement.js');

class GA {
    constructor(deploymentList, migrateScheduler, inProcessTasks, initPopulationSize) {
        this.deploymentList = deploymentList;
        this.migrateScheduler = migrateScheduler;
        this.inProcessTasks = inProcessTasks;
        this.initPopulationSize = initPopulationSize;
    }
    copulation(workNodeName, workNodeResource, vnfNameList, vnfRequestsResource, currentPodPlacement, maybeTurnOffNodeNum = 0) {
        let ga = new Placement(workNodeResource, vnfRequestsResource, this.initPopulationSize, currentPodPlacement, maybeTurnOffNodeNum);
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
    
            for (let i = 0; i < vnfNameList.length; i++) {
                let deploymentName = '';
                let podNameSpace = '';
                let podList = [];
                for (let j = 0; j < this.deploymentList.length; j++) {
                    podList = this.deploymentList[j].pod;
                    for (let a = 0; a < podList.length; a++) {
                        if (podList[a].name == vnfNameList[i]) {
                            deploymentName = this.deploymentList[j].name;
                            podNameSpace = this.deploymentList[j].namespace;
                            break;
                        }
                    }
                }
                // console.log(deploymentName);
                // console.log(podNameSpace);
                // console.log(vnfNameList[i]);
                let vnfNum = vnfNameList.indexOf(vnfNameList[i]) + 1;
                for (let j = 1; j < populationScore[0].length; j++) {
                    if (arrayFind(populationScore[0][j], (vnfNum))) {
                        console.log(colors.green(`${podNameSpace}:${deploymentName}調度安排完成`));
                        this.inProcessTasks.push(`${podNameSpace}:${deploymentName}`);
                        if (this.migrateScheduler[`${podNameSpace}:${deploymentName}`]) {
                            this.migrateScheduler[`${podNameSpace}:${deploymentName}`].push(workNodeName[j - 1]);
                        } else {
                            this.migrateScheduler[`${podNameSpace}:${deploymentName}`] = [workNodeName[j - 1]];
                        }
                        break;
                    }
                }
            }
            return true;
        } else {
            return false;
        }
    }
}
module.exports = GA;