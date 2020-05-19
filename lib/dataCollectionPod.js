const axios = require('axios');
const colors = require('colors');
const Client = require('./../node_modules/kubernetes-client').Client
const prom = require('../prometheus/query.js');
class dataCollectionPod {
    constructor() {
        this.client = new Client({ version: '1.13' });
        this.deploymentList = [];
    }
    getDeployment(getDeploymentResponse) {
        let deploymentListItems = getDeploymentResponse.body.items;
        for (let i = 0; i < deploymentListItems.length; i++) {
            if (deploymentListItems[i].metadata.name.match('coredns')) {
                console.log(colors.bgYellow('Deployment:coredns pass'));
            } else {
                this.deploymentList.push({
                    'name': deploymentListItems[i].metadata.name,
                    'namespace': deploymentListItems[i].metadata.namespace,
                    'replicas': deploymentListItems[i].spec.replicas,
                    'pod': []
                })
            };
        }
        return this.deploymentList;
    }

    getPodRequestCPU(pod) {
        return axios.get(`http://192.168.2.94:9090/api/v1/query?query=${prom.cpu.pod_resource_requests_cpu_cores(pod)}`)
            .then(function (response) {
                // console.dir(response.data.data.result, { depth: null, colors: true });
                if (response.data.data.result[0]) {
                    return Number(response.data.data.result[0].value[1]);
                } else {
                    return 0;
                }
            });
    }

    getPodRequestMemory(pod) {
        return axios.get(`http://192.168.2.94:9090/api/v1/query?query=${prom.memory.pod_resource_requests_memory_bytes(pod)}`)
            .then(function (response) {
                // console.dir(response.data.data.result, { depth: null, colors: true });
                if (response.data.data.result[0]) {
                    return Number(response.data.data.result[0].value[1]);
                } else {
                    return 0;
                }
            });
    }

    getPodRequestResource(pod, podWorkNode) {
        return Promise.all([this.getPodRequestCPU(pod), this.getPodRequestMemory(pod)]);
    }

    getDeploymentList() {
        return this.client.apis.apps.v1.deployments.get()
            .then((response) => {
                // 取得Deployment列表
                return this.getDeployment(response);
            })
            .then((deploymentList) => {
                // 依照namespaces取得Pod列表
                let getNamespacesPodListFun = [];
                for (let i = 0; i < deploymentList.length; i++) {
                    let namespaces = deploymentList[i].namespaces;
                    getNamespacesPodListFun.push(this.client.api.v1.namespaces(namespaces).pods.get());
                }
                return Promise.all(getNamespacesPodListFun);
            })
            .then((podList) => {
                // 將Pod資訊分群存入deploymentList
                for (let i = 0; i < podList.length; i++) {
                    let podListItems = podList[i].body.items;
                    for (let pod = 0; pod < podListItems.length; pod++) {
                        if (podListItems[pod].metadata.name.match(this.deploymentList[i].name) &&
                            podListItems[pod].metadata.namespace.match(this.deploymentList[i].namespace)) {
                            this.deploymentList[i].pod.push({
                                'name': podListItems[pod].metadata.name,
                                'node': podListItems[pod].spec.nodeName
                            });
                        }
                    }
                }
                return this.deploymentList;
            });
    }
}

module.exports = dataCollectionPod;