const SerialPort = require("serialport");
const Readline = SerialPort.parsers.Readline
const dotenv = require('dotenv').config();
const mongodb = require('mongodb').MongoClient;
let db;
mongodb.connect(process.env.MONGODB,{ useUnifiedTopology: true }, (err, client) => {
  db = client.db("paper");
  console.log("connect mongodb on 27017 port");
  connect();
});

const strip = function (num, precision = 10) {
  return Number(num.toFixed(precision));
}
let count = 0;
const connect = () => {
  const port = new SerialPort(process.env.serialport, { autoOpen: true }, (err) => {
    console.log(err);
    if (err) {
      setTimeout(() => {
        connect();
      }, 1000);
    }
  });
  const parser = new Readline()
  port.pipe(parser)
  port.on('open', function () {
    console.log("arduino connect");
    let collection = db.collection('powerTest1');
    parser.on('data', function (data) {
      try {
        let currentData = JSON.parse(data.toString());
        console.log(currentData);
        let current = strip(strip(Number(currentData.data1) + Number(currentData.data2)) / 2);
        collection.insertOne({
          'current': current,
          'time': new Date()
        }, (err, data) => {
          if (!err) {
            console.log(`data ${current} insert successfully`);
          }
        });
      } catch (error) {
        console.log(data.toString());
        console.log('JSON parse error');
      }
    });
  });

  port.on('close', function (err) {
    console.log('close');
    // connect();
  });
  setInterval(() => {
    count ++;
    if(count == 600){
      port.end();
    }
  }, 1000);
}