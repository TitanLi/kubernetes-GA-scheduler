const colors = require('colors');
const DataCollectionNode = require('./lib/dataCollectionNode.js');
const DataCollectionPod = require('./lib/dataCollectionPod.js');

const dataCollectionNode = new DataCollectionNode();
const dataCollectionPod = new DataCollectionPod();
async function main() {
    let workNodeName = [];
    let workNodeResource = [];
    let vnfList = [];
    let vnfRequestList = [];
    let pendingVnfList = [];
    let pendingVnfRequestList = [];
    let placement = [];
    // 取得Node資訊
    let req = await dataCollectionNode.getWorkNodeInfo();
    workNodeName = [...req.workNodeName];
    workNodeResource = req.workNodeResource;
    placement = req.placement;
    console.log(colors.red('Work Node資源'));
    console.log(workNodeName);
    console.log(workNodeResource);
    let reqDeploymentList = await dataCollectionPod.getDeploymentList();
    console.dir(reqDeploymentList, { depth: null, colors: true });
    for (let deployment = 0; deployment < reqDeploymentList.length; deployment++) {
        let deploymentPodList = reqDeploymentList[deployment].pod;
        for (let pod = 0; pod < deploymentPodList.length; pod++) {
            let podName = deploymentPodList[pod].name;
            let podWorkNode = deploymentPodList[pod].node;
            let getPodRequestResource = await dataCollectionPod.getPodRequestResource(podName, podWorkNode);
            if (podWorkNode) {
                vnfList.push(podName);
                vnfRequestList.push(getPodRequestResource);
                let vnfPosition = workNodeName.indexOf(podWorkNode);
                let vnfNum = vnfList.indexOf(podName);
                placement[vnfPosition].push(vnfNum);
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
}

main();