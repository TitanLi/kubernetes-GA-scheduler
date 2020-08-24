const Client = require('./../node_modules/kubernetes-client').Client
const colors = require('colors');
const { arrayFilter, arrayFind } = require('./../genetic-algorithm/lib/array.js');
class migrate {
    constructor(deploymentList, workNodeName, vnfNameList, migrateScheduler, inProcessTasks, deletePodNameList) {
        this.client = new Client({ version: '1.13' });
        this.deploymentList = deploymentList;
        this.workNodeName = workNodeName;
        this.vnfNameList = vnfNameList;
        this.migrateScheduler = migrateScheduler;
        this.inProcessTasks = inProcessTasks;
        this.deletePodNameList = deletePodNameList;
    }
    deletePod(namespaces, pod) {
        return this.client.api.v1.namespaces(namespaces).pods(pod).delete();
    }
    deleteNode(node) {
        return this.client.api.v1.nodes(node).delete();
    }

    /**
     * 將Worker Node設為NoSchedule
     * @param {String} node 節點名稱
     */
    setNodeNoSchedule(node) {
        const nodeLable = {
            "spec": {
                "taints": [
                    {
                        "key": "key",
                        "value": "value",
                        "effect": "NoSchedule"
                    }
                ]
            }
        }
        return this.client.api.v1.nodes(node).patch({ body: nodeLable });
    }

    /**
     * 遷移成本
     * @param {Two Dimensional Array} current 目前的放置位置
     * @param {Two Dimensional Array} renew 新的放置位置
     * @param {Array} newVnfList 待放置VNF列表
     * 
     * @returns {Number} cost 遷移成本
     * @returns {Array} vnfNum 預計遷移的VNF編號
     */
    migrationCost(current, renew, newVnfList = undefined) {
        // 預計遷移的VNF編號
        let costPod = [];
        for (let i = 0; i < current.length; i++) {
            costPod = costPod.concat(arrayFilter(current[i], renew[i]));
        }
        if (newVnfList) {
            // 加入新的VNF編號
            for (let i = 0; i < newVnfList.length; i++) {
                costPod.push(this.vnfNameList.indexOf(newVnfList[i]) + 1);
            }
        }
        return {
            'cost': costPod.length,
            'vnfNum': costPod,
        }
    }
    getMigrationTargetNode(renew, vnfNum) {
        for (let i = 0; i < renew.length; i++) {
            if (arrayFind(renew[i], vnfNum)) {
                return i;
            }
        }
        return 'getMigrationTargetNode function fail';
    }

    /**
     * 安排VNF遷移
     * @param {Three Dimensional Array} population GA放置結果
     * @param {Array} vnfNumList 預計遷移的VNF編號
     * @param {Array} deleteVnfNameList 預計遷移VNF列表
     * 
     * @returns {Promise} deletePod 預計刪除的Pod列表
     */
    setMigrateScheduler(population, vnfNumList, deleteVnfNameList = null) {
        let deletePod = [];
        // 依序處理預計遷移的VNF
        for (let i = 0; i < vnfNumList.length; i++) {
            let deploymentName = '';
            let podNameSpace = '';
            let podList = [];
            let podName = this.vnfNameList[vnfNumList[i] - 1];
            // 尋找Pod屬於哪個Deployment
            for (let j = 0; j < this.deploymentList.length; j++) {
                podList = this.deploymentList[j].pod;
                for (let a = 0; a < podList.length; a++) {
                    if (podList[a].name == podName) {
                        deploymentName = this.deploymentList[j].name;
                        podNameSpace = this.deploymentList[j].namespace;
                        break;
                    }
                }
            }
            // 開始準備VNF綁定資訊
            for (let j = 1; j < population[0].length; j++) {
                // 尋找VNF放置於哪個Worker Node
                if (arrayFind(population[0][j], vnfNumList[i])) {
                    console.log(colors.red(`處理VNF：${vnfNumList[i]}`));
                    console.log(colors.green(`${podNameSpace}:${deploymentName}調度安排完成`));
                    console.log(colors.green(`${this.workNodeName[j - 1]}`));
                    // 將處理中的Pod放入inProcessTasks
                    this.inProcessTasks.push(`${podNameSpace}:${deploymentName}`);
                    // 將VNF要綁定的Worker Node放入migrateScheduler
                    if (this.migrateScheduler[`${podNameSpace}:${deploymentName}`]) {
                        this.migrateScheduler[`${podNameSpace}:${deploymentName}`].push(this.workNodeName[j - 1]);
                    } else {
                        this.migrateScheduler[`${podNameSpace}:${deploymentName}`] = [this.workNodeName[j - 1]];
                    }
                    // 是否需刪除VNF進行遷移的動作
                    if (deleteVnfNameList && arrayFind(deleteVnfNameList, podName)) {
                        deletePod.push(this.deletePod(podNameSpace, podName));
                        this.deletePodNameList.push({
                            'namespace': podNameSpace,
                            'pod': podName
                        })
                        console.log(colors.bgYellow(`刪除Pod=>${podNameSpace}:${deploymentName}:${podName}`));
                    }
                    break;
                }
            }
        }
        return Promise.all(deletePod).catch((err)=>{console.log(err)});
    }
}

module.exports = migrate;