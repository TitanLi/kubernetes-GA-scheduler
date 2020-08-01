const Client = require('./../../node_modules/kubernetes-client').Client
const colors = require('colors');
const axios = require('axios');
const { arrayFilter, arrayFind } = require('./genetic-algorithm/lib/array.js');
const redis = require("redis");
const redisClient = redis.createClient(6379, '192.168.2.94', { no_ready_check: true });
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
    migrationCost(current, renew, newVnfList = null) {
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

    async setMigrateScheduler(populationScore, vnfNumList, deleteVnf = null) {
        let deletePod = [];
        for (let i = 0; i < vnfNumList.length; i++) {
            let deploymentName = '';
            let podNameSpace = '';
            let podList = [];
            let podName = this.vnfNameList[vnfNumList[i] - 1];
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
            for (let j = 1; j < populationScore[0].length; j++) {
                if (arrayFind(populationScore[0][j], vnfNumList[i])) {
                    console.log(colors.red(`處理VNF：${vnfNumList[i]}`));
                    console.log(colors.green(`${podNameSpace}:${deploymentName}調度安排完成`));
                    console.log(colors.green(`${this.workNodeName[j - 1]}`))
                    this.inProcessTasks.push(`${podNameSpace}:${deploymentName}`);
                    await new Promise((resolve, rejects) => {
                        redisClient.rpush('inProcessTasks', `${podNameSpace}:${deploymentName}`, (err, value) => {
                            console.log(`將${podNameSpace}:${deploymentName}加入Redis的inProcessTasks`)
                            resolve();
                        });
                    });
                    if (this.migrateScheduler[`${podNameSpace}:${deploymentName}`]) {
                        this.migrateScheduler[`${podNameSpace}:${deploymentName}`].push(this.workNodeName[j - 1]);
                    } else {
                        this.migrateScheduler[`${podNameSpace}:${deploymentName}`] = [this.workNodeName[j - 1]];
                    }
                    await new Promise((resolve, rejects) => {
                        redisClient.rpush(`${podNameSpace}:${deploymentName}`, this.workNodeName[j - 1], (err, value) => {
                            console.log(`將${this.workNodeName[j - 1]}加入${podNameSpace}:${deploymentName}`)
                            resolve();
                        });
                    });
                    if (deleteVnf && arrayFind(deleteVnf, podName)) {
                        let deletePodInfo = {
                            'namespace': podNameSpace,
                            'pod': podName
                        };
                        deletePod.push(this.deletePod(podNameSpace, podName));
                        this.deletePodNameList.push(deletePodInfo);
                        await new Promise((resolve, rejects) => {
                            redisClient.rpush('deletePodNameList', JSON.stringify(deletePodInfo), (err, value) => {
                                console.log(`將${JSON.stringify(deletePodInfo)}加入Redis的deletePodNameList`)
                                resolve();
                            });
                        });
                        console.log(colors.bgYellow(`刪除Pod=>${podNameSpace}:${deploymentName}:${podName}`));
                    }
                    break;
                }
            }
        }
        return Promise.all(deletePod);
    }
}

module.exports = migrate;