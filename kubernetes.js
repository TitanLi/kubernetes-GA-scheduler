const Client = require('./node_modules/kubernetes-client').Client
async function main() {
    try {
        // 取得Deployment列表
        const client = new Client({ version: '1.13' });

        // const deploymentList = await client.apis.apps.v1.deployments.get();
        // console.dir(deploymentList, { depth: null, colors: true });
        // const deployment = [];
        // let deploymentListItems = deploymentList.body.items;
        // for (let i = 0; i < deploymentListItems.length; i++) {
        //     deployment.push({
        //         'name':deploymentListItems[i].metadata.name,
        //         'namespace':deploymentListItems[i].metadata.namespace,
        //         'replicas':deploymentListItems[i].spec.replicas,
        //         'pod':[]
        //     })
        // }
        // let test = await client.apis.apps.v1.namespaces('sc').replicasets.get('nginx-deployment-55c56cb474');
        // console.dir(test, { depth: null, colors: true });
        // 取得Pod
        // for(let i=0;i<deployment.length;i++){
        //     let namespaces = deployment[i].namespaces;
        //     let podList = await client.api.v1.namespaces(namespaces).pods.get();
        //     let podListItems = podList.body.items;
        //     console.dir(podListItems, { depth: null, colors: true });
        //     for(let pod=0;pod<podListItems.length;pod++){
        //         if(podListItems[pod].metadata.name.match(deployment[i].name) &&
        //            podListItems[pod].metadata.namespace.match(deployment[i].namespace)){
        //             deployment[i].pod.push(podListItems[pod].metadata.name);
        //         }
        //     }
        // }
        // console.dir(deployment, { depth: null, colors: true });
        // console.log(JSON.stringify(deployment));
        // 取得Pod需求資源
    } catch (err) {
        console.error('Error: ', err)
    }
}

main()