const axios = require('axios');
const colors = require('colors');
const prom = require('../prometheus/query.js');
const { twoDimensionalArrayCopy } = require('./../genetic-algorithm/lib/array.js');
const { strip } = require('./../genetic-algorithm/lib/num.js');

class dataCollectionNode {
    constructor() {
        this.workNodeName = [];
        this.workNodeResource = [];
        this.placement = [];
    }

    findPodPosition(pod, memory, clusterControllerMaster) {
        return axios.get(`http://192.168.2.94:9090/api/v1/query?query=${prom.pod.pod_info(pod)}`)
            .then((response) => {
                let node = response.data.data.result[0].metric.node;
                if (node != clusterControllerMaster) {
                    let nodePosition = this.workNodeName.indexOf(node);
                    this.workNodeResource[nodePosition][1] = memory;
                }
                return 1;
            })
    }
    getWorkNodeInfo(clusterControllerMaster) {
        this.workNodeName = [];
        this.workNodeResource = [];
        this.placement = [];
        return axios.get(`http://192.168.2.94:9090/api/v1/query?query=${prom.cluster.node_num_cpu()}`)
            .then((response) => {
                let reqWorkNodeCPU = response.data.data.result;
                for (let i = 0; i < reqWorkNodeCPU.length; i++) {
                    if (reqWorkNodeCPU[i].metric.node == clusterControllerMaster) {
                        console.log(colors.red(`clusterControllerMaster(${clusterControllerMaster})不納入可用資源`));
                    } else {
                        this.workNodeName.push(reqWorkNodeCPU[i].metric.node);
                        this.workNodeResource.push([Number(reqWorkNodeCPU[i].value[1])]);
                        // 初始化染色體空間
                        this.placement.push([]);
                    }
                }
                return axios.get(`http://192.168.2.94:9090/api/v1/query?query=${prom.cluster.node_memory_MemAvailable_bytes()}`);
            }).then((response) => {
                let reqWorkNodeMem = response.data.data.result;
                let funArray = [];
                for (let i = 0; i < reqWorkNodeMem.length; i++) {
                    funArray.push(this.findPodPosition(reqWorkNodeMem[i].metric.pod, Number(reqWorkNodeMem[i].value[1]), clusterControllerMaster));
                }
                return Promise.all(funArray);
            }).then((response) => {
                let workNodeName = this.workNodeName;
                let workNodeResource = this.workNodeResource;
                let placement = this.placement;
                return {
                    workNodeName,
                    workNodeResource,
                    placement
                }
            });
    }
    getAvailableResources(clusterControllerMaster, vnfRequestList, maybeTurnOffNode = undefined) {
        let gaWorkNodeName = [];
        let gaWorkNodeResource = [];
        for (let i = 0; i < this.placement.length; i++) {
            let cpuUsaged = 0;
            let memoryUsaged = 0;
            if (this.workNodeName[i] == clusterControllerMaster) {
                console.log(colors.green('可放置Pod節點：Cluster Controller Master pass'));
            } else if (maybeTurnOffNode == this.workNodeName[i]) {
                console.log(colors.green(`可放置Pod節點為預計關閉節點：${this.workNodeName[i]} pass`));
            } else {
                for (let j = 0; j < this.placement[i].length; j++) {
                    let podNum = this.placement[i][j];
                    cpuUsaged = cpuUsaged + vnfRequestList[podNum - 1][0];
                    memoryUsaged = memoryUsaged + vnfRequestList[podNum - 1][1];
                }
                let workNodeAvailableCPU = strip(this.workNodeResource[i][0] - cpuUsaged);
                let workNodeAvailableMemory = strip(this.workNodeResource[i][1] - memoryUsaged);
                gaWorkNodeName.push(this.workNodeName[i]);
                gaWorkNodeResource.push([workNodeAvailableCPU, workNodeAvailableMemory]);
            }
        }
        return {
            'gaWorkNodeName': [...gaWorkNodeName],
            'gaWorkNodeResource': twoDimensionalArrayCopy(gaWorkNodeResource)
        }
    }
}

module.exports = dataCollectionNode;