const axios = require('axios');
const colors = require('colors');
const prom = require('../prometheus/query.js');
const { twoDimensionalArrayCopy } = require('./../genetic-algorithm/lib/array.js');
const { strip } = require('./../genetic-algorithm/lib/num.js');
const Client = require('./../node_modules/kubernetes-client').Client

class dataCollectionNode {
    constructor() {
        this.client = new Client({ version: '1.13' });
        this.workNodeName = [];
        this.workNodeResource = [];
        this.placement = [];
    }

    // findPodPosition(pod, memory, clusterControllerMaster) {
    //     return axios.get(`http://192.168.2.94:9090/api/v1/query?query=${prom.pod.pod_info(pod)}`)
    //         .then((response) => {
    //             let node = response.data.data.result[0].metric.node;
    //             if (node != clusterControllerMaster) {
    //                 let nodePosition = this.workNodeName.indexOf(node);
    //                 this.workNodeResource[nodePosition][1] = memory;
    //             }
    //             return 1;
    //         })
    // }
    /**
     * 取得Worker Node資訊
     * 
     * @param {String} clusterControllerMaster 
     * 
     * @returns {Array} workNodeName Worker Node名稱
     * @returns {Two Dimensional Array} workNodeResource Worker Node可用資源
     * @returns {Two Dimensional Array} placement 可用來放置VNF的空間
     */
    getWorkNodeInfo(clusterControllerMaster) {
        this.workNodeName = [];
        this.workNodeResource = [];
        this.placement = [];
        return this.client.api.v1.nodes.get()
            .then((response) => {
                // console.dir(response, { depth: null, colors: true });
                let resNodeList = response.body.items;
                for (let i = 0; i < resNodeList.length; i++) {
                    // console.dir(resNodeList[i], { depth: null, colors: true });
                    let nodeStatus = false;
                    // 取得Worker Node狀態
                    let conditions = resNodeList[i].status.conditions;
                    for (let j = 0; j < conditions.length; j++) {
                        if (conditions[j].type == 'Ready') {
                            nodeStatus = conditions[j].status;
                        }
                    }
                    // 取得Worker Node Name
                    let node = resNodeList[i].metadata.name;
                    // 取得Worker Node vCPU數量
                    let cpu = Number(resNodeList[i].status.capacity.cpu);
                    // 取得Worker Node Memory數量
                    let memory = Number(resNodeList[i].status.capacity.memory.split('Ki')[0]) * 1024;
                    // 如果Worker Node狀態為Ready且不為clusterControllerMaster
                    if (nodeStatus && node != clusterControllerMaster) {
                        this.workNodeName.push(node);
                        this.workNodeResource.push([cpu, memory]);
                        this.placement.push([]);
                    }
                }
                let workNodeName = this.workNodeName;
                let workNodeResource = this.workNodeResource;
                let placement = this.placement;
                return {
                    workNodeName,
                    workNodeResource,
                    placement
                }
            });
        // return axios.get(`http://192.168.2.94:9090/api/v1/query?query=${prom.cluster.node_num_cpu()}`)
        //     .then((response) => {
        //         let reqWorkNodeCPU = response.data.data.result;
        //         for (let i = 0; i < reqWorkNodeCPU.length; i++) {
        //             if (reqWorkNodeCPU[i].metric.node == clusterControllerMaster) {
        //                 console.log(colors.red(`clusterControllerMaster(${clusterControllerMaster})不納入可用資源`));
        //             } else {
        //                 this.workNodeName.push(reqWorkNodeCPU[i].metric.node);
        //                 this.workNodeResource.push([Number(reqWorkNodeCPU[i].value[1])]);
        //                 // 初始化染色體空間
        //                 this.placement.push([]);
        //             }
        //         }
        //         return axios.get(`http://192.168.2.94:9090/api/v1/query?query=${prom.cluster.node_memory_MemAvailable_bytes()}`);
        //     }).then((response) => {
        //         let reqWorkNodeMem = response.data.data.result;
        //         let funArray = [];
        //         for (let i = 0; i < reqWorkNodeMem.length; i++) {
        //             funArray.push(this.findPodPosition(reqWorkNodeMem[i].metric.pod, Number(reqWorkNodeMem[i].value[1]), clusterControllerMaster));
        //         }
        //         return Promise.all(funArray);
        //     }).then((response) => {
        //         let workNodeName = this.workNodeName;
        //         let workNodeResource = this.workNodeResource;
        //         let placement = this.placement;
        //         return {
        //             workNodeName,
        //             workNodeResource,
        //             placement
        //         }
        //     });
    }
    
    /**
     * 計算Work Node剩餘資源
     * 
     * @param {String} clusterControllerMaster Kubernetes Master
     * @param {Two Dimensional Array} vnfRequestList VNF資源需求列表
     * @param {String} turnOffNode 預計關閉的Worker Node
     * 
     * @returns {Array} gaWorkNodeName 可讓GA使用的Worker Node
     * @returns {Two Dimensional Array} gaWorkNodeResource 可讓GA使用的Worker Node可用資源列表
     */
    getAvailableResources(clusterControllerMaster, vnfRequestList, turnOffNode = undefined) {
        let gaWorkNodeName = [];
        let gaWorkNodeResource = [];
        for (let i = 0; i < this.placement.length; i++) {
            let cpuUsaged = 0;
            let memoryUsaged = 0;
            if (this.workNodeName[i] == clusterControllerMaster) {
                // 暫時關閉
                console.log(colors.green('可放置Pod節點：Cluster Controller Master pass'));
            } else if (this.workNodeName[i] == turnOffNode) {
                // 暫時關閉
                console.log(colors.green(`可放置Pod節點為預計關閉節點：${this.workNodeName[i]} pass`));
            } else {
                // 計算Worker Node可用剩餘資源
                for (let j = 0; j < this.placement[i].length; j++) {
                    let podNum = this.placement[i][j];
                    cpuUsaged = cpuUsaged + vnfRequestList[podNum - 1][0];
                    memoryUsaged = memoryUsaged + vnfRequestList[podNum - 1][1];
                }
                let workNodeAvailableCPU = strip(this.workNodeResource[i][0] - cpuUsaged);
                let workNodeAvailableMemory = strip(this.workNodeResource[i][1] - memoryUsaged);
                // 可作為GA放置VNF的Worker Node名字
                gaWorkNodeName.push(this.workNodeName[i]);
                // 可作為GA放置VNF的Worker Node可用資源
                gaWorkNodeResource.push([workNodeAvailableCPU, workNodeAvailableMemory]);
            }
        }
        return {
            'gaWorkNodeName': [...gaWorkNodeName],
            'gaWorkNodeResource': twoDimensionalArrayCopy(gaWorkNodeResource)
        }
    }
    /**
     * 取得叢集Ready Node
     * @returns {Array} nodeNameList Worker Node名字
     */
    getReadyNodeList() {
        return this.client.api.v1.nodes.get()
            .then((response) => {
                // console.dir(response, { depth: null, colors: true });
                let resNodeList = response.body.items;
                let nodeNameList = [];
                for (let i = 0; i < resNodeList.length; i++) {
                    // console.dir(resNodeList[i], { depth: null, colors: true });
                    let nodeStatus = false;
                    let conditions = resNodeList[i].status.conditions;
                    for (let j = 0; j < conditions.length; j++) {
                        if (conditions[j].type == 'Ready') {
                            nodeStatus = conditions[j].status;
                        }
                    }
                    if (nodeStatus) {
                        nodeNameList.push(resNodeList[i].metadata.name);
                    }
                }
                return nodeNameList;
            });
    }
}

module.exports = dataCollectionNode;