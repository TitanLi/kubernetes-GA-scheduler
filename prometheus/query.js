
module.exports = {
    cluster: { ...require('./lib/cluster.js') },
    cpu: { ...require('./lib/cpu.js') },
    memory: { ...require('./lib/memory.js') },
    bandwidth: { ...require('./lib/bandwidth.js') }
}