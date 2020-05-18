const colors = require('colors');
const Client = require('./node_modules/kubernetes-client').Client
const prom = require('./prometheus/query.js');
const axios = require('axios');

async function main() {
    let workNodeName = [];
    let workNodeResource = [];
    let vnfList = [];
    let vnfRequestList = [];
    let pendingVnfList = [];
    let pendingVnfRequestList = [];
    let placement = [];
    // 取得Node資訊
    let reqWorkNodeCPU = await axios.get(`http://192.168.2.94:9090/api/v1/query?query=${prom.cluster.node_num_cpu()}`)
        .then(function (response) {
            // console.dir(response.data.data.result, { depth: null, colors: true });
            return response.data.data.result;
        });
    for (let i = 0; i < reqWorkNodeCPU.length; i++) {
        workNodeName.push(reqWorkNodeCPU[i].metric.node);
        workNodeResource.push([reqWorkNodeCPU[i].value[1]]);
        // 初始化染色體空間
        placement.push([]);
    }
    console.log(colors.red('Work Node資源'));
    console.log(workNodeName);
    console.log(workNodeResource);
    // 取得Deployment列表
    const client = new Client({ version: '1.13' });
    const reqDeploymentList = await client.apis.apps.v1.deployments.get();
    // console.dir(deploymentList, { depth: null, colors: true });
    const deploymentList = [];
    let deploymentListItems = reqDeploymentList.body.items;
    for (let i = 0; i < deploymentListItems.length; i++) {
        if(deploymentListItems[i].metadata.name.match('coredns')){
            console.log(colors.bgYellow('Deployment:coredns pass'));
        }else{
            deploymentList.push({
                'name': deploymentListItems[i].metadata.name,
                'namespace': deploymentListItems[i].metadata.namespace,
                'replicas': deploymentListItems[i].spec.replicas,
                'pod': []
            })
        };
    }
    // 依照Deployment取得VNF
    for (let i = 0; i < deploymentList.length; i++) {
        let namespaces = deploymentList[i].namespaces;
        let podList = await client.api.v1.namespaces(namespaces).pods.get();
        let podListItems = podList.body.items;
        // console.dir(podListItems, { depth: null, colors: true });
        for (let pod = 0; pod < podListItems.length; pod++) {
            if (podListItems[pod].metadata.name.match(deploymentList[i].name) &&
                podListItems[pod].metadata.namespace.match(deploymentList[i].namespace)) {
                deploymentList[i].pod.push({
                    'name': podListItems[pod].metadata.name,
                    'node': podListItems[pod].spec.nodeName
                });
            }
        }
    }
    // console.dir(deploymentList, { depth: null, colors: true });
    // 建立VNF列表
    for (let deployment = 0; deployment < deploymentList.length; deployment++) {
        let deploymentPodList = deploymentList[deployment].pod;
        for (let vnf = 0; vnf < deploymentPodList.length; vnf++) {
            let vnfName = deploymentPodList[vnf].name;
            let vnfWorkNode = deploymentPodList[vnf].node;
            let reqVnfRequestCPU = await axios.get(`http://192.168.2.94:9090/api/v1/query?query=${prom.cpu.pod_resource_requests_cpu_cores(vnfName)}`)
                .then(function (response) {
                    // console.dir(response.data.data.result, { depth: null, colors: true });
                    return response.data.data.result;
                });
            let reqVnfRequestMem = await axios.get(`http://192.168.2.94:9090/api/v1/query?query=${prom.memory.pod_resource_requests_memory_bytes(vnfName)}`)
                .then(function (response) {
                    // console.dir(response.data.data.result, { depth: null, colors: true });
                    return response.data.data.result;
                });
            let vnfCPU = 0;
            let vnfMem = 0;
            if (reqVnfRequestCPU[0]) {
                vnfCPU = Number(reqVnfRequestCPU[0].value[1]);
                vnfMem = Number(reqVnfRequestMem[0].value[1]);
            }
            if (vnfWorkNode) {
                vnfList.push(vnfName);
                vnfRequestList.push([vnfCPU, vnfMem]);
                let vnfPosition = workNodeName.indexOf(vnfWorkNode);
                let vnfNum = vnfList.indexOf(vnfName);
                placement[vnfPosition].push(vnfNum);
            } else {
                pendingVnfList.push(vnfName);
                pendingVnfRequestList.push([vnfCPU, vnfMem]);
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