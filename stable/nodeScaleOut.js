const DataCollectionNode = require('./lib/dataCollectionNode.js');
const DataCollectionPod = require('./lib/dataCollectionPod.js');
const { arrayFind, arrayFilter, twoDimensionalArrayCopy, threeDimensionalArrayCopy, threeDimensionalArraySortByFirstElement, twoDimensionalArraySortBySecondElement } = require('./../genetic-algorithm/lib/array.js');
const GA = require('./lib/genetic-algorithm/v2/app.js');
const redis = require("redis");
const redisClient = redis.createClient(6379, '192.168.2.94', { no_ready_check: true });

let inProcessTasks = [];
const clusterControllerMaster = 'titan1';
const clusterWorkNodeMaster = 'titan4';
// 工作節點飽和度讓Work Node CPU能力減1
const workNodeSaturation = 1;
const initPopulationSize = 10;

async function nodeScaleOut() {
    // 取得Worker Node資訊
    const schedulerDataCollectionNode = new DataCollectionNode();
    const schedulerDataCollectionPod = new DataCollectionPod();
    let workNodeName = [];
    let workNodeResource = [];
    let placement = [[]];
    let workNodeInfo = await schedulerDataCollectionNode.getWorkNodeInfo(clusterControllerMaster);
    workNodeName = workNodeInfo.workNodeName;
    workNodeResource = workNodeInfo.workNodeResource;
    // 將CPU總數減飽和度(workNodeSaturation)
    for (let i = 0; i < workNodeResource.length; i++) {
        workNodeResource[i][0] = strip(workNodeResource[i][0] - workNodeSaturation);
    }
    // 取得初始化放置空間
    placement = workNodeInfo.placement;

    // 取得所有Deployment列表
    let reqDeploymentList = await schedulerDataCollectionPod.getDeploymentList();
    let vnfNameList = [];
    let vnfRequestList = [];
    let pendingVnfNameList = [];
    let pendingVnfRequestList = [];
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
                if (podWorkNode == clusterControllerMaster) {
                    console.log(`${podName}=>在clusterControllerMaster中略過此Pod`);
                } else if (arrayFind(inProcessTasks, `${deploymentNamespace}:${deploymentName}`)) {
                    console.log(colors.red(`${deploymentNamespace}:${deploymentName}等待被Binding`));
                } else {
                    console.log(colors.red(`${podName}放置於${podWorkNode}`));
                    vnfNameList.push(podName);
                    vnfRequestList.push([deploymentRequestCPU, deploymentRequestMemory]);
                    let vnfPosition = workNodeName.indexOf(podWorkNode);
                    let vnfNum = vnfNameList.indexOf(podName) + 1;
                    placement[vnfPosition].push(vnfNum);
                }
            }
        }
    }
    console.log(colors.red('運行中VNF'));
    console.log(vnfNameList);
    console.log(colors.red('待處放置VNF'));
    console.log(pendingVnfNameList);
    if (pendingVnfNameList.length > 0) {
        // 計算可用的Work Node剩餘資源
        let gaWorkNodeName = [];
        let gaWorkNodeResource = [];
        let maybeTurnOffNode = await new Promise((resolve, reject) => {
            redisClient.lrange("turnOffNodeName", 0, -1, (err, value) => {
                console.log(colors.yellow(`正在Scale In節點`));
                console.log(colors.yellow(value));
                resolve(value.length > 0 ? value[0] : undefined);
            });
        });
        let nodeAvailableResources = schedulerDataCollectionNode.getAvailableResources(clusterControllerMaster, vnfRequestList, maybeTurnOffNode);
        gaWorkNodeName = nodeAvailableResources.gaWorkNodeName;
        gaWorkNodeResource = nodeAvailableResources.gaWorkNodeResource;
        console.log(colors.red(`可用運算節點列表：`));
        console.log(gaWorkNodeName);
        console.log(colors.red(`可用運算節點資源列表：`));
        console.log(gaWorkNodeResource);
        let ga = new GA(initPopulationSize, clusterWorkNodeMaster, gaWorkNodeName);
        let initPopulationResult = ga.copulation(gaWorkNodeResource, pendingVnfNameList, pendingVnfRequestList, twoDimensionalArrayCopy(placement));
        // if (initPopulationResult) {
        //     // 一般scheduler 
        //     console.log(colors.red('新的VNF放置規劃成功'));
        //     const migrate = new Migrate(reqDeploymentList, gaWorkNodeName, pendingVnfNameList, migrateScheduler, inProcessTasks, deletePodNameList);
        //     let migrationCost = migrate.migrationCost([], [], pendingVnfNameList);
        //     let vnfNumList = migrationCost.vnfNum;
        //     await migrate.setMigrateScheduler(initPopulationResult, vnfNumList);
        // } else {

        // }
    }
}