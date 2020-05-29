const SerialPort = require("serialport");
const dotenv = require('dotenv').load();
const mongodb = require('mongodb').MongoClient;
let db;
mongodb.connect(process.env.MONGODB, (err, client) => {
    db = client.db("paper");
    console.log("connect mongodb on 27017 port");
});
function connect(){
	port = new SerialPort(process.env.serialport, { 
    	  parser: SerialPort.parsers.readline('\n'),
          autoOpen:true
	},(err)=>{
           if(err){
             setTimeout(()=>{
               connect();
             },1000);
           }
        });
        port.on('open', function() {
          console.log("arduino connect");
          let collection = localDB.collection('power-test1');
          port.on('data', function(data) {
            let currentData = JSON.parse(data);
            console.log(currentData)
            collection.insert({
                'current':currentData.current,
                'time': new Date()
            }, (err, data) => {
                if(!err){
                    console.log(`data ${currentData.current} insert successfully`);
                }
            });
          });
        });

        port.on('close', function (err) {
           console.log('close');                                                                                                                                connect();
        });
}
connect();