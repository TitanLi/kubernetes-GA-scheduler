const colors = require('colors');
const DataCollectionNode = require('./lib/dataCollectionNode.js');
const DataCollectionPod = require('./lib/dataCollectionPod.js');
const { strip } = require('./genetic-algorithm/lib/num.js');
const { arrayFind, twoDimensionalArrayCopy, threeDimensionalArrayCopy, threeDimensionalArraySortByFirstElement, twoDimensionalArraySortBySecondElement } = require('./genetic-algorithm/lib/array.js');
// const GA = require('./genetic-algorithm/v2/placement.js');
// 使用基因演算法計算遷移VNF放置位置
const initPopulationSize = 10;
const Migrate = require('./lib/migrate.js');
const migrate = new Migrate();
const inProcessTasks = [];
const clusterControllerMaster = 'titan1';
const clusterWorkNodeMaster = 'titan4';
const GA = require('./genetic-algorithm/v2/app.js');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
// 可用來驗證req.body schema
const Joi = require('joi');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
// postman
app.use(bodyParser.json());
// cors
// front-end
// headers: {
//     'Access-Control-Allow-Origin': '*'
// }
app.use(cors());
// let testNode = ['titan4', 'titan4', 'titan2', 'titan2', 'titan5', 'titan5'];
// let testNode = ['titan5', 'titan5', 'titan5'];
// let testNode = ['titan4'];
let testNode = ['titan2'];
let count = 0;
let migrateScheduler = {};
app.get('/scheduler/:namespace/:pod', (req, res) => {
    let pod = req.params.pod;
    let namespace = req.params.namespace;
    let deploymentList = Object.keys(migrateScheduler);
    let schedulerNode = '';
    let searchKey = `${namespace}:${pod}`
    console.log(`Search key：${searchKey}`);
    for (let i = 0; i < deploymentList.length; i++) {
        if (searchKey.match(deploymentList[i])) {
            schedulerNode = migrateScheduler[deploymentList[i]].shift();
            break;
        }
    }
    console.log(inProcessTasks);
    for (let i = 0; i < inProcessTasks.length; i++) {
        if (searchKey.match(inProcessTasks[i])) {
            inProcessTasks.remove(inProcessTasks[i]);
            break;
        }
    }
    console.log(inProcessTasks);
    // count++;
    // res.send(testNode[count - 1]);
    res.send(schedulerNode);
});
app.listen(3000);

// 工作節點飽和度讓Work Node CPU能力減1
const workNodeSaturation = 1;
async function main() {
    const dataCollectionNode = new DataCollectionNode();
    const dataCollectionPod = new DataCollectionPod();
    let workNodeName = [];
    let workNodeResource = [];
    let vnfList = [];
    let vnfRequestList = [];
    let pendingVnfList = [];
    let pendingVnfRequestList = [];
    let placement = [[]];
    // 取得Node資訊
    let req = await dataCollectionNode.getWorkNodeInfo(clusterControllerMaster);
    workNodeName = req.workNodeName;
    workNodeResource = req.workNodeResource;
    placement = req.placement;
    console.log(colors.red('Work Node資源'));
    console.log(workNodeName);
    // 將CPU總數減飽和度(workNodeSaturation)
    for (let i = 0; i < workNodeResource.length; i++) {
        workNodeResource[i][0] = strip(workNodeResource[i][0] - workNodeSaturation);
    }
    console.log(workNodeResource);
    // 取得所有Deployment列表
    let reqDeploymentList = await dataCollectionPod.getDeploymentList();
    console.dir(reqDeploymentList, { depth: null, colors: true });
    for (let deployment = 0; deployment < reqDeploymentList.length; deployment++) {
        let deploymentPodList = reqDeploymentList[deployment].pod;
        for (let pod = 0; pod < deploymentPodList.length; pod++) {
            let podName = deploymentPodList[pod].name;
            let podWorkNode = deploymentPodList[pod].node;
            // 取得Pod request資源
            let getPodRequestResource = await dataCollectionPod.getPodRequestResource(podName);
            // 如果Pod已被調度
            if (podWorkNode) {
                if (podWorkNode == clusterControllerMaster) {
                    console.log(`Pod ${podName} 在clusterControllerMaster(${clusterControllerMaster})中略過此Pod`);
                } else {
                    vnfList.push(podName);
                    vnfRequestList.push(getPodRequestResource);
                    let vnfPosition = workNodeName.indexOf(podWorkNode);
                    let vnfNum = vnfList.indexOf(podName);
                    placement[vnfPosition].push(vnfNum);
                }
            } else {
                pendingVnfList.push(podName);
                pendingVnfRequestList.push(getPodRequestResource);
            }
        }
    }
    console.log(colors.red('已放置VNF'));
    console.log(vnfList);
    console.log(vnfRequestList);
    console.log(colors.red('未放置VNF'));
    console.log(pendingVnfList);
    console.log(pendingVnfRequestList);
    console.log(colors.red('染色體位置'));
    console.log(placement);
    // 計算Work Node是否欠載
    let maybeTurnOffNode = [];
    for (let i = 0; i < placement.length; i++) {
        let cpuUsaged = 0;
        let memoryUsaged = 0;
        for (let j = 0; j < placement[i].length; j++) {
            let podNum = placement[i][j];
            cpuUsaged = cpuUsaged + vnfRequestList[podNum][0];
            memoryUsaged = memoryUsaged + vnfRequestList[podNum][1];
        }
        let cpuUsagedRate = 0;
        cpuUsagedRate = strip(cpuUsaged / workNodeResource[i][0]);
        let memoryUsagedRate = 0;
        memoryUsagedRate = strip(memoryUsaged / workNodeResource[i][1]);
        // console.log(`${workNodeName[i]} ${cpuUsagedRate}`);
        if (cpuUsagedRate < 0.8) {
            if (workNodeName[i] == clusterControllerMaster || workNodeName[i] == clusterWorkNodeMaster) {
                console.log(colors.green('pass'));
            } else {
                let maybeTurnOffNodeUsagedRate = strip(cpuUsagedRate + memoryUsagedRate);
                maybeTurnOffNode.push([workNodeName[i], maybeTurnOffNodeUsagedRate]);
            }
        }
    }
    console.log(colors.red(`CPU資源利用率低於門檻節點：`));
    maybeTurnOffNode.sort(twoDimensionalArraySortBySecondElement)
    console.log(maybeTurnOffNode);
    // 將欠載Node Pod進行遷移放置
    if (maybeTurnOffNode.length != 0) {
        console.log(colors.red(`預計關閉節點${maybeTurnOffNode[0][0]}`));
        // 計算可用的Work Node剩餘資源
        let gaWorkNodeName = [];
        let gaWorkNodeResource = [];
        for (let i = 0; i < placement.length; i++) {
            let cpuUsaged = 0;
            let memoryUsaged = 0;
            if (workNodeName[i] == clusterControllerMaster) {
                console.log(colors.green('可放置Pod節點：Cluster Controller Master pass'));
            } else if (maybeTurnOffNode[0][0] == workNodeName[i]) {
                console.log(colors.green(`可放置Pod節點為預計關閉節點：${workNodeName[i]} pass`));
            } else {
                for (let j = 0; j < placement[i].length; j++) {
                    let podNum = placement[i][j];
                    cpuUsaged = cpuUsaged + vnfRequestList[podNum][0];
                    memoryUsaged = memoryUsaged + vnfRequestList[podNum][1];
                }
                let workNodeAvailableCPU = strip(workNodeResource[i][0] - cpuUsaged);
                let workNodeAvailableMemory = strip(workNodeResource[i][1] - memoryUsaged);
                gaWorkNodeName.push(workNodeName[i]);
                gaWorkNodeResource.push([workNodeAvailableCPU, workNodeAvailableMemory]);
            }
        }
        console.log(colors.red(`可用運算節點列表：`));
        console.log(gaWorkNodeName);
        console.log(colors.red(`可用運算節點資源列表：`));
        console.log(gaWorkNodeResource);
        // 準備要遷移的Pod資訊
        let gaVnfName = [];
        let gaVnfResource = [];
        let nodeNum = workNodeName.indexOf(maybeTurnOffNode[0][0]);
        for (j = 0; j < placement[nodeNum].length; j++) {
            let podNum = placement[nodeNum][j];
            gaVnfName.push(vnfList[podNum]);
            gaVnfResource.push(vnfRequestList[podNum]);
        }
        console.log(colors.red(`待處理VNF列表：`));
        console.log(gaVnfName);
        console.log(colors.red(`待處理VNF所需資源列表：`));
        console.log(gaVnfResource);

        let maybeTurnOffNodeNum = workNodeName.indexOf(maybeTurnOffNode[0][0]);
        let ga = new GA(gaWorkNodeResource, gaVnfResource, initPopulationSize, twoDimensionalArrayCopy(placement), maybeTurnOffNodeNum);
        // 產生初始化基因池
        let initPopulationResult = ga.initPopulation();
        if (initPopulationResult) {
            // Method 1
            console.log(colors.red(`可成功關閉${maybeTurnOffNode[0][0]}`));
            console.log(colors.green(`開始遷移Pod`));
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
            // 遷移模組開始遷移Pod
            await migrate.setNodeNoSchedule(maybeTurnOffNode[0][0]);
            for (let i = 0; i < gaVnfName.length; i++) {
                // let podNameSpace = await dataCollectionPod.getPodNameSpace(gaVnfName[i]);
                let deploymentName = '';
                let podNameSpace = '';
                let podList = [];
                for (let j = 0; j < reqDeploymentList.length; j++) {
                    podList = reqDeploymentList[j].pod;
                    for (let a = 0; a < podList.length; a++) {
                        if (podList[a].name == gaVnfName[i]) {
                            deploymentName = reqDeploymentList[j].name;
                            podNameSpace = reqDeploymentList[j].namespace;
                            break;
                        }
                    }
                }
                console.log(deploymentName);
                console.log(podNameSpace);
                console.log(gaVnfName[i]);
                let vnfNum = gaVnfName.indexOf(gaVnfName[i]);
                for (j = 1; j < copulationResult[0].length; j++) {
                    if (arrayFind(copulationResult[0][j], (vnfNum + 1))) {
                        console.log('find');
                        inProcessTasks.push(`${podNameSpace}:${deploymentName}`);
                        if (migrateScheduler[`${podNameSpace}:${deploymentName}`]) {
                            migrateScheduler[`${podNameSpace}:${deploymentName}`].push(gaWorkNodeName[j - 1]);
                        } else {
                            migrateScheduler[`${podNameSpace}:${deploymentName}`] = [gaWorkNodeName[j - 1]];
                        }
                        break;
                    }
                }
                await migrate.deletePod(podNameSpace, gaVnfName[i]);
                // await new Promise((resolve, reject) => {
                //     setTimeout(() => {
                //         resolve();
                //     }, 10000);
                // });
            }
        } else {
            console.log(colors.red('基因演算法放置失敗無法將預計遷移VNF成功遷移'));
            console.log(colors.green('因此嘗試將所有VNF重新放置，看是否能夠關閉節點'));
            let gaWorkNodeResource = twoDimensionalArrayCopy(workNodeResource);
            let gaVnfResource = twoDimensionalArrayCopy(vnfRequestList);
            let ga = new GA(gaWorkNodeResource, gaVnfResource, initPopulationSize, twoDimensionalArrayCopy(placement));
            // 產生初始化基因池
            let initPopulationResult = ga.initPopulation();
            if (initPopulationResult) {
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
            }
            // 判斷執行中的Node數是否減少
            let countRunNode = 0
            for (let i = 1; i < copulationResult[0].length; i++) {
                if (copulationResult[0][i].length != 0) {
                    countRunNode++;
                }
            }
            if (countRunNode >= workNodeName.length) {
                // Method 2
                console.log(colors.red('VNF放置需求無法將資源利用率低的Node關閉，維持原狀'));
            } else {
                // Method 3
                console.log(colors.red(`將所有VNF從新安排後可成功關閉節點`));
                // 取得預計遷移的VNF編號
                let current = twoDimensionalArrayCopy(placement);
                // 讓Pod編號方式與基因演算法相同從1開始編號
                for (let i = 0; i < current.length; i++) {
                    for (let j = 0; j < current[i].length; j++) {
                        current[i][j] = current[i][j] + 1;
                    }
                }
                let renew = twoDimensionalArrayCopy(copulationResult[0]);
                renew.shift();
                let migrationCost = migrate.migrationCost(current, renew);
                console.log(colors.red(`預計遷移的VNF編號${migrationCost.vnfNum}`));
                let vnfNumList = migrationCost.vnfNum;
                let turnOffNode = []
                for (let i = 0; i < renew.length; i++) {
                    if (renew[i].length == 0) {
                        turnOffNode.push(workNodeName[i]);
                    }
                }
                for (let i = 0; i < turnOffNode.length; i++) {
                    migrate.setNodeNoSchedule(turnOffNode[i]);
                }
                // 依照VNF編號找尋目標放置Node
                for (let i = 0; i < vnfNumList.length; i++) {
                    let podMigrationTargetNodeNum = migrate.getMigrationTargetNode(renew, vnfNumList[i]);
                    let podName = vnfList[vnfNumList[i] - 1];
                    let deploymentName = '';
                    let podNameSpace = '';
                    let podList = [];
                    for (let j = 0; j < reqDeploymentList.length; j++) {
                        podList = reqDeploymentList[j].pod;
                        for (let a = 0; a < podList.length; a++) {
                            if (podList[a].name == podName) {
                                deploymentName = reqDeploymentList[j].name;
                                podNameSpace = reqDeploymentList[j].namespace;
                                break;
                            }
                        }
                    }
                    console.log(colors.green(`遷移的Pod名稱${podName}`));
                    console.log(colors.green(`屬於的Deployment：${deploymentName}`));
                    console.log(colors.green(`屬於的NameSpace：${podNameSpace}`));
                    console.log(colors.green(`預計放置目標節點：${workNodeName[podMigrationTargetNodeNum]}`));
                    inProcessTasks.push(`${podNameSpace}:${deploymentName}`);
                    if (migrateScheduler[`${podNameSpace}:${deploymentName}`]) {
                        migrateScheduler[`${podNameSpace}:${deploymentName}`].push(workNodeName[podMigrationTargetNodeNum]);
                    } else {
                        migrateScheduler[`${podNameSpace}:${deploymentName}`] = [workNodeName[podMigrationTargetNodeNum]];
                    }
                    console.log(migrateScheduler[`${podNameSpace}:${deploymentName}`]);
                    await migrate.deletePod(podNameSpace, podName);
                }
            }
        }
    }
}

// main();

async function scheduler() {
    // 取得Node資訊
    const schedulerDataCollectionNode = new DataCollectionNode();
    const schedulerDataCollectionPod = new DataCollectionPod();
    let workNodeName = [];
    let workNodeResource = [];
    let placement = [[]];
    let req = await schedulerDataCollectionNode.getWorkNodeInfo(clusterControllerMaster);
    workNodeName = req.workNodeName;
    workNodeResource = req.workNodeResource;
    // 將CPU總數減飽和度(workNodeSaturation)
    for (let i = 0; i < workNodeResource.length; i++) {
        workNodeResource[i][0] = strip(workNodeResource[i][0] - workNodeSaturation);
    }
    placement = req.placement;
    console.log(colors.red('Work Node資源'));
    console.log(workNodeName);
    console.log(workNodeResource);
    // 取得所有Deployment列表
    let reqDeploymentList = await schedulerDataCollectionPod.getDeploymentList();
    let vnfList = [];
    let vnfRequestList = [];
    let pendingVnfList = [];
    let pendingVnfRequestList = [];
    // console.dir(reqDeploymentList, { depth: null, colors: true });
    for (let deployment = 0; deployment < reqDeploymentList.length; deployment++) {
        let deploymentPodList = reqDeploymentList[deployment].pod;
        let deploymentName = reqDeploymentList[deployment].name;
        let deploymentNamespace = reqDeploymentList[deployment].namespace;
        let deploymentRequestCPU = reqDeploymentList[deployment].requestCPU;
        let deploymentRequestMemory = reqDeploymentList[deployment].requestMemory;
        for (let pod = 0; pod < deploymentPodList.length; pod++) {
            let podName = deploymentPodList[pod].name;
            let podWorkNode = deploymentPodList[pod].node;
            // 取得Pod request資源
            // let getPodRequestResource = await schedulerDataCollectionPod.getPodRequestResource(podName);
            // 如果Pod未被調度
            if (!podWorkNode && !arrayFind(inProcessTasks, `${deploymentNamespace}:${deploymentName}`)) {
                pendingVnfList.push(podName);
                pendingVnfRequestList.push([deploymentRequestCPU, deploymentRequestMemory]);
            } else {
                if (podWorkNode == clusterControllerMaster) {
                    console.log(`Pod ${podName} 在clusterControllerMaster(${clusterControllerMaster})中略過此Pod`);
                } else if (arrayFind(inProcessTasks, `${deploymentNamespace}:${deploymentName}`)) {
                    console.log(colors.red(`${deploymentNamespace}:${deploymentName}等待被Binding`));
                } else {
                    vnfList.push(podName);
                    vnfRequestList.push([deploymentRequestCPU, deploymentRequestMemory]);
                    let vnfPosition = workNodeName.indexOf(podWorkNode);
                    let vnfNum = vnfList.indexOf(podName) + 1;
                    placement[vnfPosition].push(vnfNum);
                }
            }
        }
    }
    console.log(colors.red('待處放置VNF'));
    console.log(pendingVnfList);
    console.log(pendingVnfRequestList);
    if (pendingVnfList.length > 0) {
        // 計算可用的Work Node剩餘資源
        let gaWorkNodeName = [];
        let gaWorkNodeResource = [];
        let nodeAvailableResources = schedulerDataCollectionNode.getAvailableResources(clusterControllerMaster, vnfRequestList);
        gaWorkNodeName = nodeAvailableResources.gaWorkNodeName;
        gaWorkNodeResource = nodeAvailableResources.gaWorkNodeResource;
        console.log(colors.red(`可用運算節點列表：`));
        console.log(gaWorkNodeName);
        console.log(colors.red(`可用運算節點資源列表：`));
        console.log(gaWorkNodeResource);
        // let schedulerGA = new GA(gaWorkNodeResource, pendingVnfRequestList, initPopulationSize, twoDimensionalArrayCopy(placement));
        // 產生初始化基因池
        let ga = new GA(reqDeploymentList, migrateScheduler, inProcessTasks, initPopulationSize);
        let initPopulationResult = ga.copulation(gaWorkNodeName, gaWorkNodeResource, pendingVnfList, pendingVnfRequestList, twoDimensionalArrayCopy(placement));
        if (initPopulationResult) {
            // 一般scheduler 
            console.log(colors.red('新的VNF調度成功'));
        } else {
            let allVnfList = vnfList.concat(pendingVnfList);
            let allVnfRequestList = vnfRequestList.concat(pendingVnfRequestList);
            initPopulationResult = ga.copulation(workNodeName, workNodeResource, allVnfList, allVnfRequestList, twoDimensionalArrayCopy(placement));
            if (initPopulationResult) {
                console.log(colors.red('為了放置新的VNF重新優化全部VNF放置位置'));
            } else {
                console.log(colors.red(`資源不足需擴展叢集`));
            }
        }
    }
    await new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, 1000);
    });
    scheduler();
}

// scheduler();

// async function asd() {
//     const schedulerDataCollectionPod = new DataCollectionPod();
//     // let asd = await schedulerDataCollectionPod.test('default','nginx-deployment');
//     let asd = await schedulerDataCollectionPod.test();
//     // console.dir(asd.body.spec.template.spec.containers[0].resources.requests, { depth: null, colors: true });
//     console.dir(asd.body.items, { depth: null, colors: true });
// }

// asd();
