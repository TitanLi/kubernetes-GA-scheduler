const colors = require('colors');
const SSH = require('ssh2').Client;
const wol = require('wol');
class autoScale {
    constructor() {
        this.ssh = new SSH();
    }
    shutDownNode(node) {
        return new Promise((resolve,reject) => {
            this.ssh.on('ready', () => {
                console.log(colors.red(`ssh connect to ${node}`));
                this.ssh.exec('sudo init 0', (err, stream) => {
                    if (err) throw err;
                    resolve('ok');
                    stream.on('close', (code, signal) => {
                        console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                        this.ssh.end();
                    }).on('data', (data) => {
                        console.log('STDOUT: ' + data);
                    }).stderr.on('data', (data) => {
                        console.log('STDERR: ' + data);
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
    openNode(MAC){
        return new Promise((resolve,reject) => {
            wol.wake(MAC, function(err, res){
                console.log(res);
                resolve();
              });
        });
    }
    addNodeToCluster(node){
        return new Promise((resolve,reject) => {
            this.ssh.on('ready', () => {
                console.log(colors.red(`ssh connect to ${node}`));
                this.ssh.exec('. /home/ubuntu/reinstall-node.sh', (err, stream) => {
                    if (err) throw err;
                    resolve('ok');
                    stream.on('close', (code, signal) => {
                        console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                        this.ssh.end();
                    }).on('data', (data) => {
                        console.log('STDOUT: ' + data);
                    }).stderr.on('data', (data) => {
                        console.log('STDERR: ' + data);
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
}

module.exports = autoScale;