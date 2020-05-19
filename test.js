const Migrate = require('./lib/migrate.js');
const AutoScale = require('./lib/autoScale.js');

const migrate = new Migrate();
// migrate.deletePod('default','nginx-deployment-6fcbf57d97-bzgl9');
// migrate.deleteNode('titan2');
const autoScale = new AutoScale();
async function main(){
    // let result = await autoScale.shutDownNode('192.168.2.95');
    // console.log(result);
    // await autoScale.openNode('a0:48:1c:a0:6e:94');
    await autoScale.addNodeToCluster('titan2');
}
main();