const axios = require('axios');
const prom = require('../prometheus/query.js');
class dataCollectionNode {
    constructor() {
        this.workNodeName = [];
        this.workNodeResource = [];
        this.placement = [];
    }
    findPodPosition(pod, memory) {
        return axios.get(`http://192.168.2.94:9090/api/v1/query?query=${prom.pod.pod_info(pod)}`)
            .then((response) => {
                let node = response.data.data.result[0].metric.node;
                let nodePosition = this.workNodeName.indexOf(node);
                this.workNodeResource[nodePosition][1] = memory;
                return 1;
            })
    }
    getWorkNodeInfo() {
        this.workNodeName = [];
        this.workNodeResource = [];
        this.placement = [];
        return axios.get(`http://192.168.2.94:9090/api/v1/query?query=${prom.cluster.node_num_cpu()}`)
            .then((response) => {
                let reqWorkNodeCPU = response.data.data.result;
                for (let i = 0; i < reqWorkNodeCPU.length; i++) {
                    this.workNodeName.push(reqWorkNodeCPU[i].metric.node);
                    this.workNodeResource.push([Number(reqWorkNodeCPU[i].value[1])]);
                    // 初始化染色體空間
                    this.placement.push([]);
                }
                return axios.get(`http://192.168.2.94:9090/api/v1/query?query=${prom.cluster.node_memory_MemAvailable_bytes()}`);
            }).then((response) => {
                let reqWorkNodeMem = response.data.data.result;
                let funArray = [];
                for (let i = 0; i < reqWorkNodeMem.length; i++) {
                    funArray.push(this.findPodPosition(reqWorkNodeMem[i].metric.pod, Number(reqWorkNodeMem[i].value[1])));
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
}

module.exports = dataCollectionNode;