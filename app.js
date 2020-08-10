const colors = require('colors');
const DataCollectionNode = require('./lib/dataCollectionNode.js');
const DataCollectionPod = require('./lib/dataCollectionPod.js');
const timer = require('./lib/timer.js');
const AutoScale = require('./lib/autoScale.js');
const autoScale = new AutoScale();
const { strip } = require('./genetic-algorithm/lib/num.js');
const { arrayFind, arrayFilter, twoDimensionalArrayCopy, twoDimensionalArraySortBySecondElement } = require('./genetic-algorithm/lib/array.js');
// const GA = require('./genetic-algorithm/v2/placement.js');
// 使用基因演算法計算遷移VNF放置位置
const initPopulationSize = 10;
const Migrate = require('./lib/migrate.js');
const inProcessTasks = [];
const clusterControllerMaster = 'titan1';
const clusterMasterWorkNode = 'titan4';
// const clusterWorkNodeList = ['titan4', 'titan2', 'titan3', 'titan5', 'titan6'];
const clusterWorkNodeList = ['titan4', 'titan2', 'titan3', 'titan5'];
const clusterWorkNodeResource = {
    'titan4': {
        'cpu': 8,
        'memory': 16000000000
    },
    'titan2': {
        'cpu': 8,
        'memory': 32000000000
    },
    'titan3': {
        'cpu': 8,
        'memory': 16000000000
    },
    'titan5': {
        'cpu': 8,
        'memory': 16000000000
    }
}
// 'titan6': {
//     'cpu': 8,
//     'memory': 16000000000
// }
const clusterWorkNodeMAC = {
    'titan2': 'a0:48:1c:a0:6e:94',
    'titan3': 'a0:48:1c:a0:6e:7d',
    'titan4': 'a0:48:1c:a0:6f:29',
    'titan5': 'a0:48:1c:a0:6e:2b'
}
// 'titan6': 'a0:d3:c1:0b:2d:81'

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
let deletingWorkerNode = '';
let migrateScheduler = {};
let deletePodNameList = [];
var openNodeStatus = true;
let timerCount = 1;
setInterval(() => {
    timerCount++;
}, 1000);
app.get('/scheduler/:namespace/:pod', (req, res) => {
    let pod = req.params.pod;
    let namespace = req.params.namespace;
    let deploymentList = Object.keys(migrateScheduler);
    let schedulerNode = '';
    let searchKey = `${namespace}:${pod}`
    const dataCollectionPod = new DataCollectionPod();
    let deletePodStatusCheck = [];
    // 查詢Pod是否存在，若不存在代表Pod已刪除
    const getPodStatus = (namespace, pod, index) => {
        return dataCollectionPod.getPodLogs(namespace, pod)
            .catch((err) => {
                deletePodNameList.splice(index, 1);
            });
    }
    for (let i = 0; i < deletePodNameList.length; i++) {
        deletePodStatusCheck.push(getPodStatus(deletePodNameList[i].namespace, deletePodNameList[i].pod, i));
    }
    // 判斷要遷移的Pod是否已成功刪除，並釋放資源
    Promise.all(deletePodStatusCheck)
        .then((value) => {
            console.log(colors.yellow(`正在刪除的Pod =>`));
            console.log(deletePodNameList);
            if (!openNodeStatus) {
                console.log(colors.yellow(`有Worker Node正在開機`));
            }
            if (deletePodNameList.length == 0 && openNodeStatus) {
                // if (deletePodNameList.length == 0) {
                for (let i = 0; i < deploymentList.length; i++) {
                    if (searchKey.match(deploymentList[i])) {
                        schedulerNode = migrateScheduler[deploymentList[i]].shift();
                        break;
                    }
                }
                for (let i = 0; i < inProcessTasks.length; i++) {
                    if (searchKey.match(inProcessTasks[i])) {
                        deleteInProcessTasks(inProcessTasks[i]);
                        break;
                    }
                }
                res.send(schedulerNode);
            } else {
                res.send('wait');
            }
        }).catch((err) => {
            res.send('wait');
        });
});
app.listen(3000);

const deleteInProcessTasks = (data) => {
    // 等待10秒後將任務從inProcessTasks列表中移除
    setTimeout(() => {
        console.log(colors.green(`移除${data}`));
        inProcessTasks.remove(data);
        console.log(colors.green(`目前inProcessTasks`));
        console.log(data);
    },10000);
}

// 工作節點飽和度讓Work Node CPU能力減1
const workNodeSaturation = 1;
async function nodeScaleIn() {
    const dataCollectionNode = new DataCollectionNode();
    const dataCollectionPod = new DataCollectionPod();
    let workNodeName = [];
    let workNodeResource = [];
    let placement = [[]];
    // 取得Node資訊
    let req = await dataCollectionNode.getWorkNodeInfo(clusterControllerMaster);
    workNodeName = req.workNodeName;
    workNodeResource = req.workNodeResource;
    // 取得初始化放置空間
    placement = req.placement;
    // 將CPU總數減飽和度(workNodeSaturation)
    for (let i = 0; i < workNodeResource.length; i++) {
        workNodeResource[i][0] = strip(workNodeResource[i][0] - workNodeSaturation);
    }
    console.log(colors.red('Work Node資源'));
    console.log(workNodeName);
    console.log(workNodeResource);
    console.log(placement);
    // 取得所有Deployment列表
    let reqDeploymentList = await dataCollectionPod.getDeploymentList();
    let vnfNameList = [];
    let vnfRequestList = [];
    let pendingVnfNameList = [];
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
            // 如果Pod未被調度
            if (!podWorkNode && !arrayFind(inProcessTasks, `${deploymentNamespace}:${deploymentName}`)) {
                pendingVnfNameList.push(podName);
                pendingVnfRequestList.push([deploymentRequestCPU, deploymentRequestMemory]);
            } else {
                if (podWorkNode == clusterControllerMaster) {
                    console.log(`Pod ${podName} 在clusterControllerMaster(${clusterControllerMaster})中略過此Pod`);
                } else if (arrayFind(inProcessTasks, `${deploymentNamespace}:${deploymentName}`)) {
                    console.log(colors.red(`${deploymentNamespace}:${deploymentName}等待被Binding`));
                } else {
                    // 建立放置位置陣列
                    let vnfPosition = workNodeName.indexOf(podWorkNode);
                    if (vnfPosition != -1) {
                        vnfNameList.push(podName);
                        vnfRequestList.push([deploymentRequestCPU, deploymentRequestMemory]);
                        let vnfNum = vnfNameList.indexOf(podName) + 1;
                        placement[vnfPosition].push(vnfNum);
                    }
                }
            }
        }
    }
    console.log(colors.red('已放置VNF'));
    console.log(vnfNameList);
    console.log(vnfRequestList);
    console.log(colors.red('未放置VNF'));
    console.log(pendingVnfNameList);
    console.log(pendingVnfRequestList);
    console.log(colors.red('染色體位置'));
    console.log(placement);
    if (pendingVnfNameList.length == 0 && inProcessTasks.length == 0) {
        // 計算Worker Node是否欠載
        let maybeTurnOffNode = [];
        let resDataCollectionNode = dataCollectionNode.getAvailableResources(clusterControllerMaster, vnfRequestList);
        for (let i = 0; i < resDataCollectionNode.gaWorkNodeName.length; i++) {
            let cpuUsagedRate = 0;
            let memoryUsagedRate = 0;
            let cpuAvailableResources = resDataCollectionNode.gaWorkNodeResource[i][0];
            let nodeName = resDataCollectionNode.gaWorkNodeName[i];
            let nodeNum = workNodeName.indexOf(nodeName);
            let nodeResourceCPU = workNodeResource[nodeNum][0];
            cpuUsagedRate = strip(strip(nodeResourceCPU - cpuAvailableResources) / nodeResourceCPU);
            if (cpuUsagedRate < 0.8) {
                if (nodeName == clusterControllerMaster || nodeName == clusterMasterWorkNode) {
                    console.log(colors.green('資源利用率不足的節點為clusterControllerMaster或clusterMasterWorkNode不可關閉pass'));
                } else {
                    let maybeTurnOffNodeUsagedRate = strip(cpuUsagedRate + memoryUsagedRate);
                    maybeTurnOffNode.push([nodeName, maybeTurnOffNodeUsagedRate]);
                }
            }
        }

        console.log(colors.red(`CPU資源利用率低於門檻節點：`));
        maybeTurnOffNode.sort(twoDimensionalArraySortBySecondElement)
        console.log(maybeTurnOffNode);
        // 將欠載Node Pod進行遷移放置
        if (maybeTurnOffNode.length != 0 && pendingVnfNameList.length == 0) {
            // if (maybeTurnOffNode.length != 0) {
            let turnOffNodeName = maybeTurnOffNode[0][0];
            console.log(colors.red(`預計關閉節點${turnOffNodeName}`));
            console.log(colors.red(`Scale In機制觸發`));
            let deploymentList = Object.keys(migrateScheduler);
            let scaleInStatus = true;
            for (let i = 0; i < deploymentList.length; i++) {
                console.log(deploymentList);
                console.log(migrateScheduler);
                console.log(turnOffNodeName);
                let status = arrayFind(migrateScheduler[deploymentList[i]], turnOffNodeName);
                if (status) {
                    scaleInStatus = false;
                }
            }
            if (scaleInStatus) {
                let gaWorkNodeName = [];
                let gaWorkNodeResource = [];
                // 計算可用的Work Node剩餘資源
                let resDataCollectionNode = dataCollectionNode.getAvailableResources(clusterControllerMaster, vnfRequestList, turnOffNodeName);
                gaWorkNodeName = resDataCollectionNode.gaWorkNodeName;
                gaWorkNodeResource = resDataCollectionNode.gaWorkNodeResource;
                console.log(colors.red(`可用運算節點列表：`));
                console.log(gaWorkNodeName);
                console.log(colors.red(`可用運算節點資源列表：`));
                console.log(gaWorkNodeResource);
                // 準備要遷移的Pod資訊
                let gaVnfName = [];
                let gaVnfResource = [];
                let maybeTurnOffNodeNum = workNodeName.indexOf(turnOffNodeName);
                for (j = 0; j < placement[maybeTurnOffNodeNum].length; j++) {
                    let podNum = placement[maybeTurnOffNodeNum][j];
                    gaVnfName.push(vnfNameList[podNum - 1]);
                    gaVnfResource.push(vnfRequestList[podNum - 1]);
                }
                console.log(colors.red(`預計遷移VNF列表：`));
                console.log(gaVnfName);
                let ga = new GA(initPopulationSize, clusterMasterWorkNode, gaWorkNodeName);
                // 產生初始化基因池
                let initPopulationResult = ga.copulation(gaWorkNodeResource, gaVnfName, gaVnfResource, twoDimensionalArrayCopy(placement), maybeTurnOffNodeNum);
                if (initPopulationResult) {
                    // 可成功將欠載的Worker Node關閉
                    console.log(colors.red(`可成功關閉${turnOffNodeName}`));
                    console.log(colors.green(`開始遷移Pod`));
                    // 遷移模組開始遷移Pod
                    const migrate = new Migrate(reqDeploymentList, gaWorkNodeName, gaVnfName, migrateScheduler, inProcessTasks, deletePodNameList);
                    await migrate.setNodeNoSchedule(turnOffNodeName);
                    let migrationCost = migrate.migrationCost([], [], gaVnfName);
                    let vnfNumList = migrationCost.vnfNum;
                    await migrate.setMigrateScheduler(initPopulationResult, vnfNumList, gaVnfName);
                    console.log(colors.green(`遷移安排完成`));
                    let shutDownNodeStatus = await deleteNode(turnOffNodeName, reqDeploymentList, vnfNumList, gaVnfName);
                    console.log(colors.red(`關閉${turnOffNodeName} 狀態：${shutDownNodeStatus}`));
                } else {
                    // 嘗試優化全局，觀察是否有Worker Node可被關閉
                    console.log(colors.red('基因演算法放置失敗無法將預計遷移VNF成功遷移'));
                    console.log(colors.green('因此嘗試將所有VNF重新放置，看是否能夠關閉節點'));
                    let gaWorkNodeName = [...workNodeName];
                    let gaWorkNodeResource = twoDimensionalArrayCopy(workNodeResource);
                    let gaVnfName = twoDimensionalArrayCopy(vnfNameList);
                    let gaVnfResource = twoDimensionalArrayCopy(vnfRequestList);
                    let ga = new GA(initPopulationSize, clusterMasterWorkNode, gaWorkNodeName);
                    // 產生初始化基因池
                    let initPopulationResult = ga.copulation(gaWorkNodeResource, gaVnfName, gaVnfResource, twoDimensionalArrayCopy(placement));
                    // 判斷執行中的Node數是否減少
                    if (initPopulationResult) {
                        let countRunNode = 0
                        for (let i = 1; i < initPopulationResult[0].length; i++) {
                            if (initPopulationResult[0][i].length != 0) {
                                countRunNode++;
                            }
                        }
                        if (countRunNode >= workNodeName.length) {
                            // 全局優化後任然無Worker Node可被關閉
                            console.log(colors.red('嘗試重新放置所有VNF任然無Node可關閉，維持原狀'));
                        } else {
                            // 全局優化後有Worker Node可被關閉
                            console.log(colors.red(`將所有VNF從新安排後可成功關閉節點`));
                            // 取得預計遷移的VNF編號
                            let current = twoDimensionalArrayCopy(placement);
                            // 讓Pod編號方式與基因演算法相同從1開始編號
                            let renew = twoDimensionalArrayCopy(initPopulationResult[0]);
                            // 將染色體分數移除保留Worker Node基因
                            renew.shift();
                            const migrate = new Migrate(reqDeploymentList, gaWorkNodeName, gaVnfName, migrateScheduler, inProcessTasks, deletePodNameList);
                            // 判斷是否有可關機節點
                            let turnOffNode = []
                            for (let i = 0; i < renew.length; i++) {
                                if (renew[i].length == 0) {
                                    turnOffNode.push(workNodeName[i]);
                                }
                            }
                            // 取出預計遷移的VNF編號
                            let migrationCost = migrate.migrationCost(current, renew);
                            let vnfNumList = migrationCost.vnfNum;
                            console.log(colors.red(`預計遷移的VNF編號${vnfNumList}`));
                            // 依照VNF編號安排其放置位置
                            let deleteVnfName = [];
                            for (let i = 0; i < vnfNumList.length; i++) {
                                deleteVnfName.push(gaVnfName[vnfNumList[i] - 1]);
                            }
                            await migrate.setMigrateScheduler(initPopulationResult, vnfNumList, deleteVnfName);
                            console.log(colors.green(`遷移安排完成`));
                            for (let i = 0; i < turnOffNode.length; i++) {
                                // 正在刪除的Worker Node，避免scheduler使用到此Worker Node
                                deletingWorkerNode = turnOffNode[i];
                                console.log(colors.red(`預計關閉${turnOffNode[i]}`));
                                // 將此Worker Node設為NoSchedule
                                await migrate.setNodeNoSchedule(turnOffNode[i]);
                                // 開始刪除Worker Node
                                let shutDownNodeStatus = await deleteNode(turnOffNode[i], reqDeploymentList, vnfNumList, gaVnfName);
                                console.log(colors.red(`關閉${turnOffNode[i]}狀態：${shutDownNodeStatus}`))
                            }
                        }
                    }
                }
            } else {
                console.log(colors.red('預計關閉的Node還有VNF為成功建立PASS'));
            }
        }
    } else {
        console.log(colors.green(`pendingVnfNameList => ${pendingVnfNameList}`));
        console.log(colors.green(`inProcessTasks => ${inProcessTasks}`));
        console.log(migrateScheduler);
        console.log(colors.red('還有VNF處於Pending狀態Scale In PASS'));
    }
    await timer.sleep(10000);
    await nodeScaleIn();
}

const deleteNode = async (turnOffNode, reqDeploymentList, migrateVnfNumList, vnfName) => {
    // 取出要遷移的Pod名稱
    let migratePodNameList = [];
    for (let i = 0; i < migrateVnfNumList.length; i++) {
        let vnfNum = migrateVnfNumList[i];
        migratePodNameList.push(vnfName[vnfNum - 1]);
    }
    let migratePodCheckStatus = await migratePodCheck(reqDeploymentList, migratePodNameList);
    if (migratePodCheckStatus) {
        await autoScale.deleteNodeInCluster(turnOffNode);
        // 暫時關閉
        // console.log(`關閉${turnOffNode}`);
        let resShutDownNode = await autoScale.shutDownNode(turnOffNode);
        return resShutDownNode;
    }
}

const migratePodCheck = async (reqDeploymentList, migratePodNameList) => {
    // 取得要刪除的Pod屬於的Deployment資訊
    const dataCollectionPod = new DataCollectionPod();
    let deletePodNameList = [];
    for (let i = 0; i < migratePodNameList.length; i++) {
        let podName = migratePodNameList[i];
        let podNameSpace = '';
        for (let j = 0; j < reqDeploymentList.length; j++) {
            let podList = reqDeploymentList[j].pod;
            for (let a = 0; a < podList.length; a++) {
                if (podList[a].name == podName) {
                    deploymentName = reqDeploymentList[j].name;
                    podNameSpace = reqDeploymentList[j].namespace;
                    deletePodNameList.push({
                        'namespace': podNameSpace,
                        'pod': podName
                    });
                    break;
                }
            }
        }
    }
    let deletePodStatusCheck = [];
    // 查詢Pod是否存在，若不存在代表Pod已刪除
    const getPodStatus = (namespace, pod, index) => {
        return dataCollectionPod.getPodLogs(namespace, pod)
            .catch((error) => {
                // 將確認已刪除的Pod移出檢查列表
                deletePodNameList.splice(index, 1);
            });
    }
    // 逐一檢查Pod是否接成功刪除
    for (let i = 0; i < deletePodNameList.length; i++) {
        deletePodStatusCheck.push(getPodStatus(deletePodNameList[i].namespace, deletePodNameList[i].pod, i));
    }
    // 判斷要遷移的Pod是否已成功刪除，並釋放資源
    await Promise.all(deletePodStatusCheck);
    await timer.sleep(500);
    if (deletePodNameList.length == 0) {
        return true;
    } else {
        return migratePodCheck(reqDeploymentList, migratePodNameList);
    }
}
setTimeout(nodeScaleIn, 10000);

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
    // 取得初始化放置空間
    placement = req.placement;
    // 暫時關閉
    // console.log(colors.red('Work Node資源'));
    // console.log(workNodeName);
    // console.log(workNodeResource);
    // 取得所有Deployment列表
    let reqDeploymentList = await schedulerDataCollectionPod.getDeploymentList();
    let vnfNameList = [];
    let vnfRequestList = [];
    let pendingVnfNameList = [];
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
            // 如果Pod未被放置且狀態為處理中
            if (!podWorkNode && !arrayFind(inProcessTasks, `${deploymentNamespace}:${deploymentName}`)) {
                // 將該Pod加入pending列表
                pendingVnfNameList.push(podName);
                pendingVnfRequestList.push([deploymentRequestCPU, deploymentRequestMemory]);
            } else {
                // 如果Pod位於Master中則PASS
                if (podWorkNode == clusterControllerMaster) {
                    console.log(`Pod ${podName} 在clusterControllerMaster(${clusterControllerMaster})中略過此Pod`);
                } else if (arrayFind(inProcessTasks, `${deploymentNamespace}:${deploymentName}`)) {
                    // 如果Pod狀態為處理中則PASS
                    console.log(colors.red(`${deploymentNamespace}:${deploymentName}等待被Binding`));
                } else {
                    // 取得目前運行中Pod位置
                    let vnfPosition = workNodeName.indexOf(podWorkNode);
                    if (vnfPosition != -1) {
                        vnfNameList.push(podName);
                        vnfRequestList.push([deploymentRequestCPU, deploymentRequestMemory]);
                        let vnfNum = vnfNameList.indexOf(podName) + 1;
                        placement[vnfPosition].push(vnfNum);
                        // console.log(`podWorkNode => ${podWorkNode}`);
                        // console.log(`podName => ${podName}`);
                        // console.log(`vnfPosition => ${vnfPosition}`);
                        // console.log(`vnfNum => ${vnfNum}`);
                    }
                }
            }
        }
    }
    console.log(colors.red('運行中VNF'));
    console.log(vnfNameList);
    console.log(vnfRequestList);
    console.log(colors.red('待處放置VNF'));
    console.log(pendingVnfNameList);
    console.log(pendingVnfRequestList);
    if (pendingVnfNameList.length > 0) {
        // 計算可用的Work Node剩餘資源
        let gaWorkNodeName = [];
        let gaWorkNodeResource = [];
        let nodeAvailableResources = schedulerDataCollectionNode.getAvailableResources(clusterControllerMaster, vnfRequestList, deletingWorkerNode);
        gaWorkNodeName = nodeAvailableResources.gaWorkNodeName;
        gaWorkNodeResource = nodeAvailableResources.gaWorkNodeResource;
        // 暫時關閉
        // console.log(colors.red(`可用運算節點列表：`));
        // console.log(gaWorkNodeName);
        // console.log(colors.red(`可用運算節點資源列表：`));
        // console.log(gaWorkNodeResource);
        // 產生初始化基因池
        let ga = new GA(initPopulationSize, clusterMasterWorkNode, gaWorkNodeName);
        let initPopulationResult = ga.copulation(gaWorkNodeResource, pendingVnfNameList, pendingVnfRequestList, twoDimensionalArrayCopy(placement));
        if (initPopulationResult) {
            // 一般scheduler 
            console.log(colors.red('新的VNF調度成功'));
            const migrate = new Migrate(reqDeploymentList, gaWorkNodeName, pendingVnfNameList, migrateScheduler, inProcessTasks, deletePodNameList);
            let migrationCost = migrate.migrationCost([], [], pendingVnfNameList);
            let vnfNumList = migrationCost.vnfNum;
            await migrate.setMigrateScheduler(initPopulationResult, vnfNumList);
        } else {
            // 全局優化放置
            let allvnfNameList = vnfNameList.concat(pendingVnfNameList);
            let allVnfRequestList = vnfRequestList.concat(pendingVnfRequestList);
            initPopulationResult = ga.copulation(workNodeResource, allvnfNameList, allVnfRequestList, twoDimensionalArrayCopy(placement));
            if (initPopulationResult) {
                // 經過全局優化後能成功放置新的VNF
                console.log(colors.red('為了放置新的VNF重新優化全部VNF放置位置'));
                let currentPlacement = twoDimensionalArrayCopy(placement);
                let newPlacement = twoDimensionalArrayCopy(initPopulationResult[0]);
                // 僅保留染色體中Worker Node基因
                newPlacement.shift();
                const migrate = new Migrate(reqDeploymentList, workNodeName, allvnfNameList, migrateScheduler, inProcessTasks, deletePodNameList);
                let migrationCost = migrate.migrationCost(currentPlacement, newPlacement, pendingVnfNameList);
                let vnfNumList = migrationCost.vnfNum;
                console.log(colors.red(`預計遷移的VNF編號`));
                console.log(vnfNumList);
                let deleteVnfName = [];
                for (let i = 0; i < vnfNumList.length; i++) {
                    deleteVnfName.push(gaVnfName[vnfNumList[i] - 1]);
                }
                await migrate.setMigrateScheduler(initPopulationResult, vnfNumList, deleteVnfName);
            } else {
                // 經過全局優化後人然無法順利放置，序進行Worker Scale Out
                console.log(colors.red(`資源不足需擴展叢集`));
                let nowNodeNameList = await schedulerDataCollectionNode.getReadyNodeList();
                let powerOffNodeNameList = arrayFilter(clusterWorkNodeList, nowNodeNameList);
                // 建立關機中的Worker Node資源列表
                let powerOffNodeResource = [];
                for (let i = 0; i < powerOffNodeNameList.length; i++) {
                    let cpu = clusterWorkNodeResource[powerOffNodeNameList[i]].cpu;
                    let memory = clusterWorkNodeResource[powerOffNodeNameList[i]].memory;
                    powerOffNodeResource.push([cpu, memory]);
                }
                // 將CPU總數減飽和度(workNodeSaturation)
                for (let i = 0; i < powerOffNodeResource.length; i++) {
                    powerOffNodeResource[i][0] = strip(powerOffNodeResource[i][0] - workNodeSaturation);
                }
                // 準備GA演算法輸入參數
                let gaWorkNodeName = [...workNodeName];
                gaWorkNodeName = gaWorkNodeName.concat(powerOffNodeNameList);
                let gaWorkNodeResource = twoDimensionalArrayCopy(workNodeResource);
                gaWorkNodeResource = gaWorkNodeResource.concat(powerOffNodeResource);
                let gaVnfName = twoDimensionalArrayCopy(vnfNameList);
                gaVnfName = gaVnfName.concat(pendingVnfNameList);
                let gaVnfResource = twoDimensionalArrayCopy(vnfRequestList);
                gaVnfResource = gaVnfResource.concat(pendingVnfRequestList);
                let ga = new GA(initPopulationSize, clusterMasterWorkNode, gaWorkNodeName);
                // 產生初始化基因池
                let initPopulationResult = ga.copulation(gaWorkNodeResource, gaVnfName, gaVnfResource, twoDimensionalArrayCopy(placement));
                // 經過Worker Node Scale Out後可成功放入該VNF
                if (initPopulationResult) {
                    openNodeStatus = false;
                    // 建立準備開啟的Worker Node列表
                    let preparationNodeList = [];
                    for (let i = 1; i <= gaWorkNodeName.length; i++) {
                        if (initPopulationResult[0][i].length != 0) {
                            let node = gaWorkNodeName[i - 1];
                            if (node != clusterMasterWorkNode) {
                                preparationNodeList.push(openNode(node));
                                console.log(colors.red(`預備開啟${node}`));
                            }
                        }
                    }
                    await Promise.all(preparationNodeList)
                        .then((value) => {
                            console.log(colors.yellow(`開機狀態 => ${value}`))
                            openNodeStatus = true;
                        }).catch((err) => {
                            console.log(colors.red(`開機狀態 => ${err}`))
                            openNodeStatus = false;
                        });
                    // 取得預計遷移的VNF編號
                    let current = twoDimensionalArrayCopy(placement);
                    // 讓Pod編號方式與基因演算法相同從1開始編號
                    let renew = twoDimensionalArrayCopy(initPopulationResult[0]);
                    // 僅保留Worker Node基因
                    renew.shift();
                    // 開始VNF放置安排
                    const migrate = new Migrate(reqDeploymentList, gaWorkNodeName, gaVnfName, migrateScheduler, inProcessTasks, deletePodNameList);
                    let migrationCost = migrate.migrationCost(current, renew, pendingVnfNameList);
                    let vnfNumList = migrationCost.vnfNum;
                    let deleteVnfName = [];
                    for (let i = 0; i < vnfNumList.length; i++) {
                        deleteVnfName.push(gaVnfName[vnfNumList[i] - 1]);
                    }
                    console.log(colors.red(`預計遷移的VNF編號${vnfNumList}`));
                    await migrate.setMigrateScheduler(initPopulationResult, vnfNumList, deleteVnfName);
                    console.log(colors.green(`遷移安排完成等待被綁定`));
                } else {
                    console.log(colors.red('調度失敗'));
                }
            }
        }
    }
    await timer.sleep(1000);
    scheduler();
}

const openNode = async (node) => {
    const dataCollectionNode = new DataCollectionNode();
    let MAC = clusterWorkNodeMAC[node];
    await autoScale.openNode(MAC);
    console.log(colors.red(`${node}啟動中`));
    let timeout = 0;
    let pingStatus = false;
    while (timeout < 100 && !pingStatus) {
        pingStatus = await autoScale.pingNode(node);
        await timer.sleep(1000);
        timeout++;
    }
    // 機器啟動成功
    if (pingStatus) {
        console.log(colors.red(`${node}啟動成功`));
        // 加入Node進入叢集
        await timer.sleep(1000);
        let addNodeToClusterStatus = await autoScale.addNodeToCluster(node)
            .catch((err) => {
                console.log(colors.red(`${node}加入叢集失敗`));
                return err;
            });
        if (addNodeToClusterStatus) {
            console.log(colors.red(`${node}加入叢集成功`));
            console.log(colors.red(`${node}正在初始化`));
            let nodeNameList = await dataCollectionNode.getReadyNodeList();
            let time = 0;
            while (!arrayFind(nodeNameList, node)) {
                nodeNameList = await dataCollectionNode.getReadyNodeList();
                await timer.sleep(1000);
                console.log(colors.green(`等待${time}秒`));
                time++;
            }
            console.log(colors.red(`${node}初始化完成`));
        }
    }
}

scheduler();

setInterval(() => {
    console.log(colors.bgYellow(migrateScheduler));
    console.log(colors.bgYellow(inProcessTasks));
}, 1000);