const colors = require('colors');
const DataCollectionPod = require('./../dataCollectionPod.js');
const timer = require('./../timer.js');
const AutoScale = require('./../autoScale.js');
const autoScale = new AutoScale();

const deleteNode = async (turnOffNode, reqDeploymentList, migrateVnfNumList, vnfName) => {
    // 取出要遷移的Pod名稱
    let migratePodNameList = [];
    for (let i = 0; i < migrateVnfNumList.length; i++) {
        let vnfNum = migrateVnfNumList[i];
        migratePodNameList.push(vnfName[vnfNum - 1]);
    }
    let migratePodCheckStatus = await migratePodCheck(reqDeploymentList, migratePodNameList);
    // 暫時關閉
    // console.log(migratePodCheckStatus);
    if (migratePodCheckStatus) {
        await autoScale.deleteNodeInCluster(turnOffNode);
        // 暫時關閉
        // console.log(`關閉${turnOffNode}`);
        let resShutDownNode = await autoScale.shutDownNode(turnOffNode);
        return resShutDownNode;
    }
}

const migratePodCheck = async (reqDeploymentList, migratePodNameList) => {
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
                // console.log(index);
                deletePodNameList.splice(index, 1);
            });
    }
    for (let i = 0; i < deletePodNameList.length; i++) {
        deletePodStatusCheck.push(getPodStatus(deletePodNameList[i].namespace, deletePodNameList[i].pod, i));
    }
    // 判斷要遷移的Pod是否已成功刪除，並釋放資源
    await Promise.all(deletePodStatusCheck);
    // 暫時關閉
    console.log(colors.red(`等待Pod遷移`));
    await timer.sleep(500);
    if (deletePodNameList.length == 0) {
        return true;
    } else {
        return migratePodCheck(reqDeploymentList, migratePodNameList);
    }
}

module.exports = {
    deleteNode: deleteNode
}