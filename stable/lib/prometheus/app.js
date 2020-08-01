const query = require('./query.js');
const axios = require('axios');

async function main(){
    let data = await axios.get(`http://192.168.2.94:9090/api/v1/query?query=${query.cpu.pod_resource_requests_cpu_cores('nginx-deployment-6fcbf57d97-kzf2k')}`);
    // let data = await axios.get(`http://192.168.2.94:9090/api/v1/query?query=${query.bandwidth.pod_current_receive_bandwidth("default","myapp-pod")}`);
    console.dir(data.data, {depth: null, colors: true});
}

main();