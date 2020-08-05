const colors = require('colors');
const GA = require('./lib/genetic-algorithm/v2/app.js');
const Migrate = require('./lib/migrate.js');
const { deleteNode } = require('./lib/nodeScale/deleteNode.js');
const DataCollectionNode = require('./lib/dataCollectionNode.js');
const DataCollectionPod = require('./lib/dataCollectionPod.js');
const { strip } = require('./lib/genetic-algorithm/lib/num.js');
const timer = require('./lib/timer.js');
const { arrayFind, arrayFilter, twoDimensionalArrayCopy, threeDimensionalArrayCopy, threeDimensionalArraySortByFirstElement, twoDimensionalArraySortBySecondElement } = require('./../genetic-algorithm/lib/array.js');
const redis = require("redis");
const redisClient = redis.createClient(6379, '192.168.2.94', { no_ready_check: true });
// 共用
// 工作節點飽和度讓Work Node CPU能力減1
const workNodeSaturation = 1;
let inProcessTasks = [];
const clusterControllerMaster = 'titan1';
const clusterWorkNodeMaster = 'titan4';

const initPopulationSize = 10;
let migrateScheduler = {};
let deletePodNameList = [];
async function main() {
    const dataCollectionNode = new DataCollectionNode();
    const dataCollectionPod = new DataCollectionPod();
    let workNodeName = [];
    let workNodeResource = [];
    let placement = [[]];
    // 取得Node資訊
    let workNodeInfo = await dataCollectionNode.getWorkNodeInfo(clusterControllerMaster);
    workNodeName = workNodeInfo.workNodeName;
    workNodeResource = workNodeInfo.workNodeResource;
    // 取得初始化放置空間
    placement = workNodeInfo.placement;
    // 將CPU總數減飽和度(workNodeSaturation)
    for (let i = 0; i < workNodeResource.length; i++) {
        workNodeResource[i][0] = strip(workNodeResource[i][0] - workNodeSaturation);
    }
    console.log(colors.red('Work Node資源'));
    console.log(colors.yellow('Work Node Name'));
    console.log(workNodeName);
    console.log(colors.yellow('Work Node Resource'));
    console.log(workNodeResource);
    console.log(colors.yellow('Work Node初始化放置空間'));
    console.log(placement);

    // 取得所有Deployment列表
    let deploymentList = await dataCollectionPod.getDeploymentList();
    let vnfNameList = [];
    let vnfRequestList = [];
    let pendingVnfNameList = [];
    let pendingVnfRequestList = [];
    // console.dir(deploymentList, { depth: null, colors: true });
    for (let deployment = 0; deployment < deploymentList.length; deployment++) {
        let deploymentPodList = deploymentList[deployment].pod;
        let deploymentName = deploymentList[deployment].name;
        let deploymentNamespace = deploymentList[deployment].namespace;
        let deploymentRequestCPU = deploymentList[deployment].requestCPU;
        let deploymentRequestMemory = deploymentList[deployment].requestMemory;
        for (let pod = 0; pod < deploymentPodList.length; pod++) {
            let podName = deploymentPodList[pod].name;
            let podWorkNode = deploymentPodList[pod].node;
            // 取得處理中的任務列表
            inProcessTasks = await new Promise((resolve, rejects) => {
                redisClient.lrange('inProcessTasks', 0, -1, (err, value) => {
                    resolve(value);
                });
            });
            // 如果Pod未被調度
            if (!podWorkNode && !arrayFind(inProcessTasks, `${deploymentNamespace}:${deploymentName}`)) {
                pendingVnfNameList.push(podName);
                pendingVnfRequestList.push([deploymentRequestCPU, deploymentRequestMemory]);
            } else {
                // 建立已經被安排的Pod放置位置列表
                if (podWorkNode == clusterControllerMaster) {
                    console.log(`Pod ${podName} 在clusterControllerMaster(${clusterControllerMaster})中略過此Pod`);
                } else if (arrayFind(inProcessTasks, `${deploymentNamespace}:${deploymentName}`)) {
                    console.log(colors.red(`${deploymentNamespace}:${deploymentName}等待被Binding`));
                } else {
                    console.log(colors.red(`${podName}放置於${podWorkNode}`));
                    vnfNameList.push(podName);
                    vnfRequestList.push([deploymentRequestCPU, deploymentRequestMemory]);
                    // 取得VNF所在的Work Node
                    let vnfPosition = workNodeName.indexOf(podWorkNode);
                    // 將VNF編號
                    let vnfNum = vnfNameList.indexOf(podName) + 1;
                    placement[vnfPosition].push(vnfNum);
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

    // 若無VNF在pending狀態及所有任務完成，可開始進行Scale In判斷
    if (pendingVnfNameList.length == 0 && inProcessTasks.length == 0) {
        // 計算Work Node是否欠載
        let maybeTurnOffNode = [];
        // 取得節點剩餘資源
        let nodeAvailableResources = dataCollectionNode.getAvailableResources(clusterControllerMaster, vnfRequestList);
        for (let i = 0; i < nodeAvailableResources.gaWorkNodeName.length; i++) {
            // 計算資源使用率
            let cpuUsagedRate = 0;
            let nodeName = nodeAvailableResources.gaWorkNodeName[i];
            let nodeNum = workNodeName.indexOf(nodeName);
            let cpuAvailableResources = nodeAvailableResources.gaWorkNodeResource[i][0];
            let nodeResourceCPU = workNodeResource[nodeNum][0];
            cpuUsagedRate = strip(strip(nodeResourceCPU - cpuAvailableResources) / nodeResourceCPU);
            // 若資源利用率低於門檻的節點為Kubernetes Master或主要Worker Node
            if (cpuUsagedRate < 0.8) {
                if (nodeName == clusterControllerMaster || nodeName == clusterWorkNodeMaster) {
                    console.log(colors.green('資源利用率不足的節點為clusterControllerMaster或clusterWorkNodeMaster不可關閉pass'));
                } else {
                    maybeTurnOffNode.push([nodeName, cpuUsagedRate]);
                }
            }
        }
        // 依照資源利用率排序
        maybeTurnOffNode.sort(twoDimensionalArraySortBySecondElement);
        console.log(colors.red(`CPU資源利用率低於門檻節點：`));
        console.log(maybeTurnOffNode);
        // 將欠載Node Pod進行遷移放置
        if (maybeTurnOffNode.length != 0 && pendingVnfNameList.length == 0) {
            // 預計關閉的Worker Node
            let turnOffNodeName = maybeTurnOffNode[0][0];
            console.log(colors.red(`預計關閉節點${turnOffNodeName}`));
            console.log(colors.red(`Scale In機制觸發`));
            // 判斷是否有VNF即將遷移至預計關閉的Worker Node
            let deploymentKeys = Object.keys(migrateScheduler);
            let scaleInStatus = true;
            for (let i = 0; i < deploymentKeys.length; i++) {
                let status = arrayFind(migrateScheduler[deploymentKeys[i]], turnOffNodeName);
                if (status) {
                    scaleInStatus = false;
                }
            }
            // 可以開始進行Worker Node Scale In
            if (scaleInStatus) {
                let gaWorkNodeName = [];
                let gaWorkNodeResource = [];
                // 計算可用的Work Node剩餘資源
                let nodeAvailableResources = dataCollectionNode.getAvailableResources(clusterControllerMaster, vnfRequestList, turnOffNodeName);
                gaWorkNodeName = nodeAvailableResources.gaWorkNodeName;
                gaWorkNodeResource = nodeAvailableResources.gaWorkNodeResource;
                console.log(colors.red(`可用運算節點列表：`));
                console.log(gaWorkNodeName);
                console.log(colors.red(`可用運算節點資源列表：`));
                console.log(gaWorkNodeResource);
                // 準備要遷移的VNF資訊
                let gaVnfName = [];
                let gaVnfResource = [];
                // 取得Worker Node編號
                let maybeTurnOffNodeNum = workNodeName.indexOf(turnOffNodeName);
                // 取得預計遷移的VNF Name和Resource
                for (j = 0; j < placement[maybeTurnOffNodeNum].length; j++) {
                    let podNum = placement[maybeTurnOffNodeNum][j];
                    gaVnfName.push(vnfNameList[podNum - 1]);
                    gaVnfResource.push(vnfRequestList[podNum - 1]);
                }
                // 開始基因交配
                let ga = new GA(initPopulationSize, clusterWorkNodeMaster, gaWorkNodeName);
                // 產生初始化基因池
                let copulationPopulationResult = ga.copulation(gaWorkNodeResource, gaVnfName, gaVnfResource, twoDimensionalArrayCopy(placement), maybeTurnOffNodeNum);
                // 有Worker Node資源利用率低於門檻值，且該節點可以順利關閉
                if (copulationPopulationResult) {
                    await new Promise((resolve, reject) => {
                        console.log(colors.red(`可成功關閉${turnOffNodeName}`));
                        console.log(colors.yellow(`將${turnOffNodeName}加入Redis turnOffNodeName`));
                        redisClient.rpush("turnOffNodeName", turnOffNodeName, (err, value) => {
                            resolve(value);
                        });
                    });
                    console.log(colors.green(`開始遷移Pod`));
                    // 遷移模組開始遷移Pod
                    const migrate = new Migrate(deploymentList, gaWorkNodeName, gaVnfName, migrateScheduler, inProcessTasks, deletePodNameList);
                    // 將要關機的Worker Node設為NoSchedule
                    await migrate.setNodeNoSchedule(turnOffNodeName);
                    // 取出要遷移的VNF編號
                    let migrationCost = migrate.migrationCost([], [], gaVnfName);
                    let vnfNumList = migrationCost.vnfNum;
                    // 安排VNF放置位置
                    await migrate.setMigrateScheduler(copulationPopulationResult, vnfNumList, gaVnfName);
                    console.log(colors.green(`遷移安排完成`));
                    // 關閉Worker Node
                    let shutDownNodeStatus = await deleteNode(turnOffNodeName, deploymentList, vnfNumList, gaVnfName);
                    console.log(colors.red(`關閉${turnOffNodeName} 狀態：${shutDownNodeStatus}`));
                    await new Promise((resolve, reject) => {
                        console.log(colors.yellow(`將${turnOffNodeName}從Redis turnOffNodeName刪除`));
                        redisClient.lrem("turnOffNodeName", -1, turnOffNodeName, (err, value) => {
                            resolve(value);
                        });
                    });
                } else {
                    // 有Worker Node資源利用率低於門檻值，但該節點無法關閉，嘗試全局優化
                    console.log(colors.red('基因演算法放置失敗無法將預計遷移VNF成功遷移'));
                    console.log(colors.green('因此嘗試將所有VNF重新放置，看是否能夠關閉節點'));
                    // 基因交配
                    let gaWorkNodeName = [...workNodeName];
                    let gaWorkNodeResource = twoDimensionalArrayCopy(workNodeResource);
                    let gaVnfName = twoDimensionalArrayCopy(vnfNameList);
                    let gaVnfResource = twoDimensionalArrayCopy(vnfRequestList);
                    let ga = new GA(initPopulationSize, clusterWorkNodeMaster, gaWorkNodeName);
                    // 產生放置結果
                    let copulationPopulationResult = ga.copulation(gaWorkNodeResource, gaVnfName, gaVnfResource, twoDimensionalArrayCopy(placement));
                    // 判斷放置結果是否成功
                    if (copulationPopulationResult) {
                        // 計算執行中的Node數量
                        let countRunNode = 0
                        // 判斷執行中的Node數是否減少
                        for (let i = 1; i < copulationPopulationResult[0].length; i++) {
                            if (copulationPopulationResult[0][i].length != 0) {
                                countRunNode++;
                            }
                        }
                        if (countRunNode >= workNodeName.length) {
                            // 經過全局優化後任然無Worker Node可被關閉
                            console.log(colors.red('嘗試重新放置所有VNF任然無Node可關閉，維持原狀'));
                        } else {
                            // 經過全局優化後有Worker Node可被關閉
                            console.log(colors.red(`將所有VNF從新安排後可成功關閉節點`));
                            // 取得目前的VNF放置位置
                            let current = twoDimensionalArrayCopy(placement);
                            // 取得優化後VNF放置位置
                            let renew = twoDimensionalArrayCopy(copulationPopulationResult[0]);
                            // 移除染色體分數
                            renew.shift();
                            const migrate = new Migrate(deploymentList, gaWorkNodeName, gaVnfName, migrateScheduler, inProcessTasks, deletePodNameList);
                            // 判斷是否有可關機節點
                            let turnOffNode = []
                            for (let i = 0; i < renew.length; i++) {
                                if (renew[i].length == 0) {
                                    turnOffNode.push(workNodeName[i]);
                                }
                            }
                            let migrationCost = migrate.migrationCost(current, renew);
                            // 取得VNF預計遷移的VNF編號
                            let vnfNumList = migrationCost.vnfNum;
                            console.log(colors.red(`預計遷移的VNF編號${vnfNumList}`));
                            // 依照VNF編號找尋目標放置Node
                            await migrate.setMigrateScheduler(copulationPopulationResult, vnfNumList, gaVnfName);
                            console.log(colors.green(`遷移資料準備完成`));
                            for (let i = 0; i < turnOffNode.length; i++) {
                                // 將預計關閉的Node設為NoSchedule
                                await new Promise((resolve, reject) => {
                                    console.log(colors.red(`預計關閉${turnOffNode[i]}`));
                                    console.log(colors.yellow(`將${turnOffNode[i]}加入Redis turnOffNodeName`));
                                    redisClient.rpush("turnOffNodeName", turnOffNode[i], (err, value) => {
                                        resolve(value);
                                    });
                                });
                                await migrate.setNodeNoSchedule(turnOffNode[i]);
                                // 刪除Node
                                let shutDownNodeStatus = await deleteNode(turnOffNode[i], deploymentList, vnfNumList, gaVnfName);
                                console.log(colors.red(`關閉${turnOffNode[i]}狀態：${shutDownNodeStatus}`));
                                await new Promise((resolve, reject) => {
                                    console.log(colors.yellow(`將${turnOffNode[i]}從Redis turnOffNodeName刪除`));
                                    redisClient.lrem("turnOffNodeName", -1, turnOffNode[i], (err, value) => {
                                        resolve(value);
                                    });
                                });
                                break;
                            }
                        }
                    }
                }
            } else {
                console.log(colors.red('預計關閉的Node還有VNF未成功建立PASS'));
            }
        }
    } else {
        console.log(colors.red('還有VNF處於Pending狀態Scale In PASS'));
    }
    await timer.sleep(10000);
    await main();
}

setTimeout(main, 10000);