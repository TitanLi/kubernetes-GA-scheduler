const axios = require('axios');
const colors = require('colors');
const Client = require('./../../node_modules/kubernetes-client').Client
const prom = require('./prometheus/query.js');
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
            } else if (deploymentListItems[i].metadata.name.match('prometheus')) {
                console.log(colors.bgYellow('Deployment:prometheus pass'));
            } else {
                let podContainers = deploymentListItems[i].spec.template.spec.containers;
                let requestCPU = 0;
                let requestMemory = 0;
                for (let j = 0; j < podContainers.length; j++) {
                    if (podContainers[j].resources.requests) {
                        requestCPU = requestCPU + (Number(podContainers[j].resources.requests.cpu) || 0);
                        requestMemory = requestMemory + (Number(podContainers[j].resources.requests.memory.split('Mi')[0] * 1024 * 1024) || 0);
                    }
                }
                // console.dir(deploymentListItems[i], { depth: null, colors: true });
                this.deploymentList.push({
                    'name': deploymentListItems[i].metadata.name,
                    'namespace': deploymentListItems[i].metadata.namespace,
                    'replicas': deploymentListItems[i].spec.replicas,
                    'replicaSetName': '',
                    'requestCPU': requestCPU,
                    'requestMemory': requestMemory,
                    'pod': []
                });
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

    getPodRequestResource(pod) {
        return Promise.all([this.getPodRequestCPU(pod), this.getPodRequestMemory(pod)]);
    }

    getDeploymentList() {
        return this.client.apis.apps.v1.deployments.get()
            .then((response) => {
                // 取得Deployment列表
                return this.getDeployment(response);
            })
            .then(() => {
                let getReplicasetsFun = [];
                for (let i = 0; i < this.deploymentList.length; i++) {
                    getReplicasetsFun.push(this.getReplicasets(this.deploymentList[i].namespace, this.deploymentList[i].name));
                }
                return Promise.all(getReplicasetsFun);
            })
            .then((replicasetsNameList) => {
                for (let i = 0; i < replicasetsNameList.length; i++) {
                    this.deploymentList[i].replicaSetName = replicasetsNameList[i]
                }
            })
            .then(() => {
                // 依照namespaces取得Pod列表
                let getNamespacesPodListFun = [];
                for (let i = 0; i < this.deploymentList.length; i++) {
                    let namespaces = this.deploymentList[i].namespaces;
                    getNamespacesPodListFun.push(this.client.api.v1.namespaces(namespaces).pods.get());
                }
                return Promise.all(getNamespacesPodListFun);
            })
            .then((podList) => {
                // 將Pod資訊分群存入deploymentList
                for (let i = 0; i < podList.length; i++) {
                    let podListItems = podList[i].body.items;
                    for (let pod = 0; pod < podListItems.length; pod++) {
                        // console.dir(podListItems[pod], { depth: null, colors: true });
                        let deploymentNamespace = this.deploymentList[i].namespace;
                        if (podListItems[pod].metadata.name.match(`${this.deploymentList[i].replicaSetName}`) &&
                            podListItems[pod].metadata.namespace.match(deploymentNamespace)) {
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

    // 取得Deployment相對應的RS
    getReplicasets(namespace, deploymentName) {
        return this.client.apis.apps.v1.namespaces(namespace).replicasets.get()
            .then((response) => {
                let replicasetsItems = response.body.items;
                for (let i = 0; i < replicasetsItems.length; i++) {
                    let ownerReferences = replicasetsItems[i].metadata.ownerReferences[0].name;
                    if (ownerReferences == deploymentName) {
                        return replicasetsItems[i].metadata.name;
                    }
                }
            });
    }


    getPodNameSpace(pod) {
        return axios.get(`http://192.168.2.94:9090/api/v1/query?query=${prom.pod.pod_info(pod)}`)
            .then(function (response) {
                // console.dir(response.data.data.result, { depth: null, colors: true });
                if (response.data.data.result[0]) {
                    return response.data.data.result[0].metric.namespace;
                } else {
                    return '';
                }
            });
    }

    getPodLogs(namespace, pod) {
        return this.client.api.v1.namespaces(namespace).pods(pod).log.get();
    }
}

module.exports = dataCollectionPod;