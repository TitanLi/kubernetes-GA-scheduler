const Client = require('./../node_modules/kubernetes-client').Client
class migrate {
    constructor() {
        this.client = new Client({ version: '1.13' });
    }
    deletePod(namespaces, pod) {
        return this.client.api.v1.namespaces(namespaces).pods(pod).delete();
    }
    deleteNode(node){
        return this.client.api.v1.nodes(node).delete();
    }
    setNodeNoSchedule(node){
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
}

module.exports = migrate;