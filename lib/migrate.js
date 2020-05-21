const Client = require('./../node_modules/kubernetes-client').Client
const { arrayFilter, arrayFind } = require('./../genetic-algorithm/lib/array.js');
class migrate {
    constructor() {
        this.client = new Client({ version: '1.13' });
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
    migrationCost(current, renew) {
        let costPod = [];
        for (let i = 0; i < current.length; i++) {
            costPod = costPod.concat(arrayFilter(current[i], renew[i]));
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
}

module.exports = migrate;