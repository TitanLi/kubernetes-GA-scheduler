const colors = require('colors');
const timer = require('./timer.js');
const SSH = require('ssh2').Client;
const wol = require('wol');
const ping = require('ping');
const Client = require('./../../node_modules/kubernetes-client').Client
class autoScale {
    constructor() {
        this.client = new Client({ version: '1.13' });
    }
    shutDownNode(node) {
        return new Promise((resolve, reject) => {
            let ssh = new SSH();
            ssh.on('ready', () => {
                console.log(colors.red(`ssh connect to ${node}`));
                ssh.exec('sudo init 0', (err, stream) => {
                    if (err) throw err;
                    stream.on('close', (code, signal) => {
                        // console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                        resolve(true);
                        // ssh.end();
                    }).on('data', (data) => {
                        // console.log('STDOUT: ' + data);
                    }).stderr.on('data', (data) => {
                        // console.log('STDERR: ' + data);
                        reject();
                    });
                });
            }).connect({
                'host': node,
                'port': 22,
                'username': 'root',
                'privateKey': require('fs').readFileSync('/root/.ssh/id_rsa')
            });
        });
    }
    openNode(MAC) {
        return new Promise((resolve, reject) => {
            wol.wake(MAC, function (err, res) {
                // 暫時關閉
                // console.log(res);
                resolve();
            });
        });
    }
    deleteNodeInCluster(node) {
        return this.client.api.v1.nodes(node).delete();
    }

    async addNodeToCluster(node) {
        let connectNode = () => {
            return new Promise((resolve, reject) => {
                let ssh = new SSH();
                ssh.on('ready', () => {
                    console.log(colors.red(`ssh connect to ${node}`));
                    ssh.exec('. /home/ubuntu/reinstall-node.sh', (err, stream) => {
                        if (err) {
                            // throw err;
                            reject(false);
                        };
                        stream.on('close', (code, signal) => {
                            // 暫時關閉
                            // console.log(`${node} >>>> Stream :: close :: code: ${code} , signal: ${signal}`);
                            resolve(true);
                            // ssh.end();
                        }).on('data', (data) => {
                            // 暫時關閉
                            // console.log(`${node} >>>> STDOUT: ${data}`);
                        }).stderr.on('data', (data) => {
                            // console.log('STDERR: ' + data);
                        });
                    });
                }).on('error', (err) => {
                    // 暫時關閉
                    // console.log(colors.red(`${node}連線錯誤`));
                    resolve(this.addNodeToCluster(node));
                }).connect({
                    'host': node,
                    'port': 22,
                    'username': 'root',
                    'privateKey': require('fs').readFileSync('/root/.ssh/id_rsa')
                });
            });
        }
        await timer.sleep(1000);
        let result = await connectNode();
        return result;
    }
    pingNode(data) {
        return ping.promise.probe(data)
            .then(function (res) {
                // console.log(res.output);
                if (res.avg == "unknown") {
                    return false;
                } else {
                    return true;
                }
            });
    }
}

module.exports = autoScale;