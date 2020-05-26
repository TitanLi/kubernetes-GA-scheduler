// const Migrate = require('./lib/migrate.js');
// const AutoScale = require('./lib/autoScale.js');

// const migrate = new Migrate();
// migrate.deletePod('default','nginx-deployment-6fcbf57d97-bzgl9');
// migrate.deleteNode('titan2');
// const autoScale = new AutoScale();
const sleep = function (t) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, t);
    });
}
async function main(t,name){
    // let result = await autoScale.shutDownNode('192.168.2.95');
    // console.log(result);
    // await autoScale.openNode('a0:48:1c:a0:6e:94');
    // await autoScale.addNodeToCluster('titan2');
    console.log(name);
    await sleep(t);
}
async function test(){
    await main(3000,'test1');
    await main(10000,'test2');
}
async function test1(){
    await test();
    await test1();
}
test1();
Promise.all([test1(),test1(),test1(),test1()])