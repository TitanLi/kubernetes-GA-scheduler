// const compute = [2, 4, 4, 4, 6, 8, 8, 8, 10, 12];
const compute = [8, 8, 8, 8, 8, 8, 8, 8, 8, 8];
// [ 10 ], [], [], [], [], [ 6 ], [], [], [], [ 2, 3, 5 ], [ 2, 4, 6 ] 
const vnf = [2, 2, 3, 4, 5, 6, 6];
// const vnf = [1, 1, 1, 1, 2, 2, 3, 4, 5, 6, 6];
const initGenSize = 10;
let initGen = new Array(initGenSize);

Array.prototype.indexOf = function (val) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] == val) return i;
    }
    return -1;
};

Array.prototype.remove = function (val) {
    var index = this.indexOf(val);
    if (index > -1) {
        this.splice(index, 1);
    }
};

// 在基因大小中新增計算節點維度
for (let i = 0; i < initGen.length; i++) {
    // 新增計算維度
    initGen[i] = new Array(compute.length + 1);
    initGen[i][0] = [null];
    // 在計算節點中新增放置空間
    for (let j = 1; j <= compute.length; j++) {
        // 新增維度
        initGen[i][j] = new Array(0);
    }
}

// 複製二維陣列至新的記憶體位置
const twoDimensionalArrayCopy = function (currentArray) {
    let newArray = currentArray.map(function (arr) {
        return arr.slice();
    });
    return newArray;
}

// 複製三維陣列至新的記憶體位置
const arrayCopy = function (currentArray) {
    let newArray = currentArray.map(function (arr1) {
        let newArray1 = arr1.map(function (arr2) {
            return arr2.slice()
        });
        return newArray1;
    });
    return newArray;
}

// 陣列總和
const sumData = function (arr) {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
        sum += arr[i];
    };
    return sum;
}

// 陣列比較
const arrayCompare = function (arr1, arr2) {
    return JSON.stringify(arr1.sort()) == JSON.stringify(arr2.sort());
}

// arr1與arr2比較，在arr1中去除在arr2中重複項
const arrayFilter = function (arr1, arr2) {
    let arrResult = arr1.slice();
    for (let i = 0; i < arr2.length; i++) {
        arrResult.remove(arr2[i]);
    }
    return arrResult;
}

// 在arr中找出是否包含元素
const arrayFind = function (arr, data) {
    let found = arr.find(element => element == data);
    return found == undefined ? false : true;
}

// 解決javascript float問題
// 0.1 + 0.2 = 0.30000000000000004
const strip = function (num, precision = 12) {
    return +parseFloat(num.toPrecision(precision));
}

// 產生初始化基因池
const init = function () {
    return new Promise((resolve, reject) => {
        // 基因數量大小
        for (let i = 0; i < initGenSize; i++) {
            let initCompute = compute.slice();
            let initVNF = vnf.slice();
            // 產生基因
            while (initVNF.length != 0) {
                // 隨機選擇
                let computeCompute = Math.floor(Math.random() * initCompute.length);
                let vnfCount = Math.floor(Math.random() * initVNF.length);
                // 確認選擇到的物品是否可放入計算節點
                if (initCompute[computeCompute] >= initVNF[vnfCount]) {
                    // 將資料放入相對應位子當作初始化基因
                    initGen[i][computeCompute + 1].push(initVNF[vnfCount]);
                    // 更新計算節點剩餘資源
                    initCompute[computeCompute] = initCompute[computeCompute] - initVNF[vnfCount];
                    // 將目標物體移出
                    let index = initVNF.indexOf(initVNF[vnfCount]);
                    if (index > -1) {
                        initVNF.splice(index, 1);
                    }
                }
            }
        }
        resolve(arrayCopy(initGen));
    });
}

// 為基因給予評分
const geneScore = function (data) {
    let genScore = 0;
    let runNode = 0;
    for (let j = 1; j <= compute.length; j++) {
        if (data[j].length > 0) {
            genScore = genScore + (sumData(data[j]) / compute[j - 1]);
            runNode = runNode + 1;
        }
    }
    // 使用結點數越少分數越高
    let usageRate = compute.length - runNode
    return strip(Number(genScore.toFixed(2)) + usageRate);
}

// 為初始化基因給予評分
const initScore = function (data) {
    return new Promise((resolve, reject) => {
        let geneScoreResult = arrayCopy(data);
        for (let i = 0; i < geneScoreResult.length; i++) {
            geneScoreResult[i][0][0] = geneScore(geneScoreResult[i]);
        }
        resolve(geneScoreResult);
    });
}

// 基因交配
const copulation = function (data) {
    return new Promise((resolve, reject) => {
        let copulation_Data = arrayCopy(data);
        // 用於比較輸出結果是否有超過Compute能力
        let initCompute = compute.slice();
        // 隨機選擇要交換的基因位置
        let copulationPoint = Math.floor(Math.random() * initCompute.length) + 1;
        // 隨機選擇要交換的基因組
        let geneSelection1 = Math.floor(Math.random() * copulation_Data.length);
        let geneSelection2 = Math.floor(Math.random() * copulation_Data.length);
        // 父基因與母基因(二維度陣列)
        let father = twoDimensionalArrayCopy(copulation_Data[geneSelection1]);
        let mother = twoDimensionalArrayCopy(copulation_Data[geneSelection2]);
        // 保留初始基因(二維度陣列)
        let originFatherGen = twoDimensionalArrayCopy(copulation_Data[geneSelection1]);
        let originMotherGen = twoDimensionalArrayCopy(copulation_Data[geneSelection2]);
        // 基因交換暫存使用
        let cache = 0;
        // 交換基因位置使用(一維度陣列)
        let fatherGen = father[copulationPoint].slice();
        let motherGen = mother[copulationPoint].slice();
        // 如果被選中的基因都沒有東西將不做處理
        if (fatherGen.length > 0 | motherGen.length > 0) {
            // father[0][0] = true;
            // mother[0][0] = true;
            if (!arrayCompare(fatherGen, motherGen)) {
                // 預設交換基因為成功
                let copulationStatus = true;
                // 基因交換(一維度陣列)
                cache = fatherGen.slice();
                fatherGen = motherGen.slice();
                motherGen = cache.slice();
                // 更新基因回暫存基因陣列
                father[copulationPoint] = fatherGen.slice();
                mother[copulationPoint] = motherGen.slice();
                // 過濾基因，用來處理交配後重複及缺少基因問題(一維度陣列)
                // 父基因 => 1.需刪除deduplicationFatherGen重複基因 2.補上缺少基因deduplicationMotherGen
                // 母基因 => 1.需刪除deduplicationMotherGen重複基因 2.補上缺少基因deduplicationFatherGen
                let deduplicationFatherGen = arrayFilter(originMotherGen[copulationPoint], originFatherGen[copulationPoint]);
                let deduplicationMotherGen = arrayFilter(originFatherGen[copulationPoint], originMotherGen[copulationPoint]);
                // 處理deduplicationFatherGen
                for (let j = 0; j < deduplicationFatherGen.length; j++) {
                    let fatherCount = 0;
                    let motherCount = 0;
                    // 刪除父親重複基因
                    let deleteRepeat = true;
                    while (deleteRepeat && copulationStatus) {
                        for (let deduplication = 1; deduplication <= initCompute.length; deduplication++) {
                            if ((deduplication != copulationPoint) && (arrayFind(father[deduplication], deduplicationFatherGen[j]))) {
                                // 將結果更新(一維度陣列)
                                father[deduplication] = arrayFilter(father[deduplication], [deduplicationFatherGen[j]]).slice();
                                deleteRepeat = false;
                                break;
                                // console.log(`選擇父基因位子 : ${deduplication}`);
                                // console.log(`刪除 ${deduplicationFatherGen[j]} 基因`);
                            }
                        }
                        // Debug用
                        fatherCount++;
                        if (fatherCount > 100) {
                            console.log(`處理deduplicationFatherGen\nFather Count ${fatherCount} Break`);
                            copulationStatus = false;
                        }
                    }

                    // 加入母親欠缺基因
                    let addGen = true;
                    while (addGen && copulationStatus) {
                        for (let addGenPoint = 1; addGenPoint <= initCompute.length; addGenPoint++) {
                            // 不將欠缺基因加入原先位子
                            if (addGenPoint != copulationPoint) {
                                // 判斷新增基因加入後是否超出節點負擔
                                if ((sumData(mother[addGenPoint]) + deduplicationFatherGen[j]) <= initCompute[addGenPoint - 1]) {
                                    mother[addGenPoint].push(deduplicationFatherGen[j]);
                                    addGen = false;
                                    break;
                                    // console.log(`選擇母基因位子 : ${addGenPoint}`);
                                    // console.log(`加入 ${deduplicationFatherGen[j]} 基因`);
                                }
                            }
                            // Debug用
                            motherCount++;
                            if (motherCount > 100) {
                                console.log(`處理deduplicationFatherGen\nMother Count ${motherCount} Break`);
                                copulationStatus = false;
                            }
                        }
                    }
                }
                // 處理deduplicationMotherGen
                for (let j = 0; j < deduplicationMotherGen.length; j++) {
                    let fatherCount = 0;
                    let motherCount = 0;
                    // 加入父親欠缺基因
                    let addGen = true;
                    while (addGen && copulationStatus) {
                        for (let addGenPoint = 1; addGenPoint <= initCompute.length; addGenPoint++) {
                            // 不將欠缺基因加入原先位子
                            if (addGenPoint != copulationPoint) {
                                // 判斷新增基因加入後是否超出節點負擔
                                if ((sumData(father[addGenPoint]) + deduplicationMotherGen[j]) <= initCompute[addGenPoint - 1]) {
                                    father[addGenPoint].push(deduplicationMotherGen[j]);
                                    addGen = false;
                                    break;
                                    // console.log(`選擇父基因位子 : ${addGenPoint}`);
                                    // console.log(`加入 ${deduplicationMotherGen[j]} 基因`);
                                }
                            }
                            // Debug用
                            fatherCount++;
                            if (fatherCount > 100) {
                                console.log(`處理deduplicationMotherGen\nFather Count ${fatherCount} Break`);
                                copulationStatus = false;
                            }
                        }
                    }
                    // 刪除母親重複基因
                    let deleteRepeat = true;
                    while (deleteRepeat && copulationStatus) {
                        for (let deduplication = 1; deduplication <= initCompute.length; deduplication++) {
                            if ((deduplication != copulationPoint) && (arrayFind(mother[deduplication], deduplicationMotherGen[j]))) {
                                // 將結果更新(一維度陣列)
                                mother[deduplication] = arrayFilter(mother[deduplication], [deduplicationMotherGen[j]]).slice();
                                deleteRepeat = false;
                                break;
                                // console.log(`選擇母基因位子 : ${deduplication}`);
                                // console.log(`刪除 ${deduplicationMotherGen[j]} 基因`);
                            }
                            // Debug用
                            motherCount++;
                            if (motherCount > 100) {
                                console.log(`處理deduplicationMotherGen\nMother Count ${motherCount} Break`);
                                copulationStatus = false;
                            }
                        }
                    }
                }
                if (copulationStatus) {
                    // 父親基因與前代基因選好的
                    let fatherGeneScore = geneScore(father);
                    if (copulation_Data[geneSelection1][0][0] < fatherGeneScore) {
                        father[0][0] = fatherGeneScore;
                        copulation_Data[geneSelection1] = twoDimensionalArrayCopy(father);
                    } else {
                        copulation_Data[geneSelection1] = twoDimensionalArrayCopy(originFatherGen);
                    }
                    // 母親基因與前代基因選好的
                    let motherGeneScore = geneScore(mother);
                    if (copulation_Data[geneSelection2][0][0] < motherGeneScore) {
                        mother[0][0] = motherGeneScore;
                        copulation_Data[geneSelection2] = twoDimensionalArrayCopy(mother);
                    } else {
                        copulation_Data[geneSelection2] = twoDimensionalArrayCopy(originMotherGen);
                    }
                }
            }
        }
        resolve(copulation_Data);
    });
}

async function test() {
    // 產生初始化基因池
    let initResult = await init();
    // 為初始化基因給予評分
    let initScoreGen = await initScore(initResult);
    let cache_Data;
    for (let i = 0; i < 100000; i++) {
        if (i == 0) {
            let initCopulationResult = await copulation(initScoreGen);
            cache_Data = arrayCopy(initCopulationResult);
        } else {
            let copulationResult = await copulation(cache_Data);
            cache_Data = arrayCopy(copulationResult);
        }
    }
    // initGen[0][0][0] = 123;
    // cache_Data[1][0][0] = 456;
    // console.log(initResult);
    console.log('初始化基因');
    console.log(initScoreGen.sort());
    console.log('GA優化');
    console.log(cache_Data.sort());
    // console.log(initGen);
}

test();