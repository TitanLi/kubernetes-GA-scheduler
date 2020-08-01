const colors = require('colors');
const { strip } = require('./lib/genetic-algorithm/lib/num.js');
const DataCollectionPod = require('./lib/dataCollectionPod.js');
const { arrayFind, arrayFilter, twoDimensionalArrayCopy, threeDimensionalArrayCopy, threeDimensionalArraySortByFirstElement, twoDimensionalArraySortBySecondElement } = require('./lib/genetic-algorithm/lib/array.js');
const timer = require('./lib/timer.js');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const Joi = require('joi');
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());
const redis = require("redis");
const { resolve } = require('path');
const { rejects } = require('assert');
const redisClient = redis.createClient(6379, '192.168.2.94', { no_ready_check: true });

// 暫存
let openNodeStatus = true;
app.get('/scheduler/:namespace/:pod', (req, res) => {
    let pod = req.params.pod;
    let namespace = req.params.namespace;
    let schedulerNode = '';
    // let deploymentList = Object.keys(migrateScheduler);
    let searchKey = `${namespace}:${pod}`
    const dataCollectionPod = new DataCollectionPod();
    // 查詢Pod是否存在，若不存在代表Pod已刪除
    const getPodStatus = (namespace, pod, index) => {
        return dataCollectionPod.getPodLogs(namespace, pod)
            .catch((error) => {
                // 將已成功刪除的Pod Name移出Redis deletePodNameList
                return new Promise((resolve, rejects) => {
                    let deletePodInfo = {
                        'namespace': namespace,
                        'pod': pod
                    };
                    redisClient.lrem('deletePodNameList', -1, JSON.stringify(deletePodInfo), (err, value) => {
                        console.log(`從Redis deletePodNameList中刪除 => ${namespace}:${pod}`);
                        resolve();
                    });
                });
            });
    }
    let deletePodNameList = [];
    new Promise((resolve, rejects) => {
        redisClient.lrange('deletePodNameList', 0, -1, (err, value) => {
            if (value.length != 0) { console.log(`取出deletePodNameList => ${JSON.stringify(value)}`); }
            resolve(value);
        });
    }).then((response) => {
        let deletePodStatusCheck = [];
        deletePodNameList = response;
        for (let i = 0; i < deletePodNameList.length; i++) {
            let podInfo = JSON.parse(deletePodNameList[i]);
            deletePodStatusCheck.push(getPodStatus(podInfo.namespace, podInfo.pod, i));
        }
        return deletePodStatusCheck;
    }).then((deletePodStatusCheck) => {
        // 判斷要遷移的Pod是否已成功刪除，並釋放資源
        return Promise.all(deletePodStatusCheck)
            .then((res) => {
                console.log(`Delete Pod Status Check`);
                console.log(res);
            }).catch((err) => {
                console.log(err);
                res.send('wait');
            });
    }).then(async () => {
        if (deletePodNameList.length == 0 && openNodeStatus) {
            // if (deletePodNameList.length == 0) {
            let deploymentList = [];
            deploymentList = await new Promise((resolve, rejects) => {
                redisClient.keys('*', (err, value) => {
                    console.log(colors.green('取出redis Keys列表'));
                    console.log(1);
                    resolve(value);
                });
            });
            console.log(colors.green(deploymentList));
            for (let i = 0; i < deploymentList.length; i++) {
                if (searchKey.match(deploymentList[i])) {
                    console.log(3);
                    console.log('searchKey' + searchKey);
                    console.log(deploymentList[i]);
                    // 取出目標Worker Node
                    schedulerNode = await new Promise((resolve, rejects) => {
                        console.log(4);
                        redisClient.lpop(deploymentList[i], (err, value) => {
                            resolve(value);
                        });
                    });
                    console.log(`將${searchKey}放入${schedulerNode}`);
                    // 從inProcessTasks移除待處理deployment Pod
                    await new Promise((resolve, rejects) => {
                        console.log(5);
                        redisClient.lrem('inProcessTasks', -1, deploymentList[i], (err, value) => {
                            if (value) {
                                console.log(`從inProcessTasks移除${deploymentList[i]}`);
                            }
                            resolve();
                        });
                    });
                    break;
                }
            }
        }
        if (schedulerNode != '') {
            console.log(colors.yellow(schedulerNode));
            res.send(schedulerNode)
        } else {
            res.send('wait');
        }
    }).catch((err) => {
        console.log(err);
        res.send('wait');
    });
});

app.listen(3000);