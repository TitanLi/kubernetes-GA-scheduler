const color = require('colors');
const { strip } = require('../lib/num.js');
const { twoDimensionalArrayCopy, threeDimensionalArrayCopy, arrayCompare, arrayFilter, arrayFind, arraySum } = require('./../lib/array.js');
class GA {
    constructor(compute, vnf, initPopulationSize) {
        this.compute = compute;
        this.vnf = vnf;
        this.initPopulationSize = initPopulationSize;
    }

    // 為染色體給予評分
    geneScore(data) {
        let score = 0;
        let runNode = 0;
        let usageRate = 0;
        let ans = 0;
        for (let j = 1; j <= this.compute.length; j++) {
            if (data[j].length > 0) {
                score = strip(score + strip(arraySum(data[j]) / this.compute[j - 1]));
                runNode = runNode + 1;
            }
        }
        // 使用結點數越少分數越高
        usageRate = (this.compute.length - runNode) * 2;
        ans = Number((score + usageRate).toFixed(2));
        return ans;
    }

    // 為初始化基因給予評分
    getScore(data) {
        let geneScoreResult = threeDimensionalArrayCopy(data);
        for (let i = 0; i < geneScoreResult.length; i++) {
            geneScoreResult[i][0][0] = this.geneScore(geneScoreResult[i]);
        }
        return geneScoreResult;
    }

    // 初始化人口
    initPopulation() {
        /**
         * 初始化基因陣列
         */
        let initGen = new Array(this.initPopulationSize);
        // 在基因大小中新增計算節點維度
        for (let i = 0; i < initGen.length; i++) {
            // 新增計算維度
            initGen[i] = new Array(this.compute.length + 1);
            initGen[i][0] = [null];
            // 在計算節點中新增放置空間
            for (let j = 1; j <= this.compute.length; j++) {
                // 新增維度
                initGen[i][j] = new Array(0);
            }
        }
        /**
         * 未初始化基因陣列隨機填值
         */
        for (let i = 0; i < this.initPopulationSize; i++) {
            // 初始化變數
            let initComputeResource = [...this.compute];
            let initVNF = [...this.vnf];
            let vnfSelect = true;
            let selectVNF = 0;
            let catchComputeResource = [];
            // 產生基因
            while (initVNF.length != 0) {
                // 隨機選擇VNF
                if (vnfSelect) {
                    selectVNF = Math.floor(Math.random() * initVNF.length);
                    // 暫存單次VNF放置演算法還可嘗試的放置位置
                    catchComputeResource = [...Array(initComputeResource.length).keys()];
                }
                let selectCatchComputeResourcePoint = Math.floor(Math.random() * catchComputeResource.length);
                let setPosition = catchComputeResource[selectCatchComputeResourcePoint];

                // 確認選擇到的物品是否可放入計算節點
                if (initComputeResource[setPosition] >= initVNF[selectVNF]) {
                    // 將資料放入相對應位子當作初始化基因
                    initGen[i][setPosition + 1].push(initVNF[selectVNF]);
                    // 更新計算節點剩餘資源
                    initComputeResource[setPosition] = initComputeResource[setPosition] - initVNF[selectVNF];
                    // 將目標物體移出
                    initVNF.remove(initVNF[selectVNF]);
                    // 放置成功選擇新的VNF
                    vnfSelect = true;
                } else {
                    // VNF嘗試放置所選位置失敗，將該位置剔除，選擇新的位置
                    vnfSelect = false;
                    catchComputeResource.remove(setPosition);
                    // 當所有節點剩餘資源皆無法放置VNF時代表本次初始化基因失敗需重新放置
                    if (catchComputeResource.length == 0) {
                        vnfSelect = true;
                        // 在計算節點中新增放置空間
                        for (let j = 1; j <= this.compute.length; j++) {
                            // 新增維度
                            initGen[i][j] = new Array(0);
                        }
                        initVNF.length = 0;
                        i--;
                    };
                }
            }
        }
        console.log(`基因檢查:${(this.check(threeDimensionalArrayCopy(initGen))) ? color.green("成功") : color.red("失敗")}`);
        return threeDimensionalArrayCopy(initGen);
    }

    // 基因交配
    copulation(data) {
        let copulationData = threeDimensionalArrayCopy(data);
        // 用於比較輸出結果是否有超過Compute能力
        let initComputeResource = [...this.compute];
        // 隨機選擇要交換的基因位置
        let genePoint = Math.floor(Math.random() * initComputeResource.length);
        // 隨機選擇要交換的基因組
        let peopleSelection1 = Math.floor(Math.random() * copulationData.length);
        let peopleSelection2 = Math.floor(Math.random() * copulationData.length);
        // 父基因與母基因(二維度陣列)
        let father = twoDimensionalArrayCopy(copulationData[peopleSelection1]);
        let mother = twoDimensionalArrayCopy(copulationData[peopleSelection2]);
        father[0][0] = null;
        mother[0][0] = null;
        // 保留初始基因(二維度陣列)
        let originFatherGen = twoDimensionalArrayCopy(copulationData[peopleSelection1]);
        let originMotherGen = twoDimensionalArrayCopy(copulationData[peopleSelection2]);
        // 交換基因位置使用(一維度陣列)
        let fatherGen = [...father[genePoint + 1]];
        let motherGen = [...mother[genePoint + 1]];
        // 如果被選中的基因都沒有東西將不做處理
        if (fatherGen.length > 0 | motherGen.length > 0) {
            if (!arrayCompare(fatherGen, motherGen)) {
                // 預設交換基因為成功
                let copulationStatus = true;
                // 更新基因回暫存基因陣列
                father[genePoint + 1] = [...motherGen];
                mother[genePoint + 1] = [...fatherGen];
                // 過濾基因，用來處理交配後重複及缺少基因問題(一維度陣列)
                // 父基因 => 1.需刪除deduplicationFatherGen重複基因 2.補上缺少基因deduplicationMotherGen
                // 母基因 => 1.需刪除deduplicationMotherGen重複基因 2.補上缺少基因deduplicationFatherGen
                let deduplicationFatherGen = arrayFilter(motherGen, fatherGen);
                let deduplicationMotherGen = arrayFilter(fatherGen, motherGen);
                // 暫存除交換節點以外可選擇放置VNF的節點
                let cacheComputeNode = [...Array(initComputeResource.length).keys()];
                cacheComputeNode.remove(genePoint);
                // 處理deduplicationFatherGen
                if (copulationStatus && deduplicationFatherGen.length > 0) {
                    for (let j = 0; j < deduplicationFatherGen.length; j++) {
                        // 刪除父親重複基因
                        let cell = deduplicationFatherGen[j];
                        // 暫存含有重複VNF的Node
                        let cacheDeduplicationGene = [];
                        copulationStatus = true;
                        // 過濾包含父親重複VNF基因
                        for (let deduplication = 1; deduplication <= initComputeResource.length; deduplication++) {
                            if (deduplication != (genePoint + 1)) {
                                let fatherGene = [...father[deduplication]];
                                if (arrayFind(fatherGene, cell)) {
                                    cacheDeduplicationGene.push(deduplication);
                                }
                            }
                        }
                        // 隨機需選擇候選節點刪除重複cell
                        let selectDeleteDeduplicationGene = cacheDeduplicationGene[Math.floor(Math.random() * cacheDeduplicationGene.length)];
                        // 刪除(一維度陣列)
                        father[selectDeleteDeduplicationGene] = arrayFilter(father[selectDeleteDeduplicationGene], [cell]);

                        // 加入母親欠缺基因
                        let copyCacheComputeNode = [...cacheComputeNode];
                        while (copyCacheComputeNode.length != 0) {
                            // 隨機選出候選節點
                            let selectPoint = Math.floor(Math.random() * copyCacheComputeNode.length);
                            let addGenePoint = copyCacheComputeNode[selectPoint];
                            // 判斷新增基因加入後是否超出節點負擔
                            if ((arraySum(mother[addGenePoint + 1]) + cell) <= initComputeResource[addGenePoint]) {
                                mother[addGenePoint + 1].push(cell);
                                // 預設交換基因為成功
                                copulationStatus = true;
                                copyCacheComputeNode = [];
                            } else {
                                copulationStatus = false;
                                copyCacheComputeNode.remove(addGenePoint);
                            }
                        }
                        if (!copulationStatus) {
                            // console.log(color.red("基因交配重組失敗"));
                            // console.log(color.red("原因母基因加入欠缺VNF失敗"));
                            return false;
                        }
                    }
                }
                // 處理deduplicationMotherGen
                if (copulationStatus) {
                    for (let j = 0; j < deduplicationMotherGen.length; j++) {
                        // 刪除母親重複基因
                        let cell = deduplicationMotherGen[j];
                        // 暫存含有重複VNF的Node
                        let cacheDeduplicationGene = [];
                        copulationStatus = true;
                        // 過濾包含母親重複VNF基因
                        for (let deduplication = 1; deduplication <= initComputeResource.length; deduplication++) {
                            if (deduplication != (genePoint + 1)) {
                                let motherGene = [...mother[deduplication]];
                                if (arrayFind(motherGene, cell)) {
                                    cacheDeduplicationGene.push(deduplication);
                                }
                            }
                        }
                        // 隨機需選擇候選節點刪除重複cell
                        let selectDeleteDeduplicationGene = cacheDeduplicationGene[Math.floor(Math.random() * cacheDeduplicationGene.length)];
                        // 刪除(一維度陣列)
                        mother[selectDeleteDeduplicationGene] = arrayFilter(mother[selectDeleteDeduplicationGene], [cell]);

                        // 加入父親欠缺基因
                        let copyCacheComputeNode = [...cacheComputeNode];
                        while (copyCacheComputeNode.length != 0) {
                            // 隨機選出候選節點
                            let selectPoint = Math.floor(Math.random() * copyCacheComputeNode.length);
                            let addGenePoint = copyCacheComputeNode[selectPoint];
                            // 判斷新增基因加入後是否超出節點負擔
                            if ((arraySum(father[addGenePoint + 1]) + cell) <= initComputeResource[addGenePoint]) {
                                father[addGenePoint + 1].push(cell);
                                // 預設交換基因為成功
                                copulationStatus = true;
                                copyCacheComputeNode = [];
                            } else {
                                copulationStatus = false;
                                copyCacheComputeNode.remove(addGenePoint);
                            }
                        }
                        if (!copulationStatus) {
                            // console.log(color.red("基因交配重組失敗"));
                            // console.log(color.red("原因父基因加入欠缺VNF失敗"));
                            return false;
                        }
                    }
                }

                if (copulationStatus) {
                    // 父親基因與前代基因選好的
                    let fatherGeneScore = this.geneScore(father);
                    if (copulationData[peopleSelection1][0][0] <= fatherGeneScore) {
                        father[0][0] = fatherGeneScore;
                        copulationData[peopleSelection1] = twoDimensionalArrayCopy(father);
                    } else {
                        copulationData[peopleSelection1] = twoDimensionalArrayCopy(originFatherGen);
                    }
                    // 母親基因與前代基因選好的
                    let motherGeneScore = this.geneScore(mother);
                    if (copulationData[peopleSelection2][0][0] <= motherGeneScore) {
                        mother[0][0] = motherGeneScore;
                        copulationData[peopleSelection2] = twoDimensionalArrayCopy(mother);
                    } else {
                        copulationData[peopleSelection2] = twoDimensionalArrayCopy(originMotherGen);
                    }
                    if (!this.check(threeDimensionalArrayCopy([copulationData[peopleSelection1]]))) {
                        console.log(`父基因檢查:${color.red("失敗")}`);
                    }
                    if (!this.check(threeDimensionalArrayCopy([copulationData[peopleSelection2]]))) {
                        console.log(`母基因檢查:${color.red("失敗")}`);
                    }
                }
            }
        }
        return threeDimensionalArrayCopy(copulationData);
    }

    // 基因變異
    mutation(data) {
        let copulationData = threeDimensionalArrayCopy(data);
        // 用於比較輸出結果是否有超過Compute能力
        let initComputeResource = [...this.compute];
        // 隨機選擇要突變的人口
        let selectPeople = Math.floor(Math.random() * copulationData.length);
        // 隨機選擇要交換的基因位置
        let selectGenePoint1 = Math.floor(Math.random() * initComputeResource.length);
        let selectGenePoint2 = Math.floor(Math.random() * initComputeResource.length);
        // 父基因與母基因(二維度陣列)
        let mutationPeople = twoDimensionalArrayCopy(copulationData[selectPeople]);
        let mutationPeopleGene1 = [...mutationPeople[selectGenePoint1 + 1]];
        let mutationPeopleGene2 = [...mutationPeople[selectGenePoint2 + 1]];
        mutationPeople[0][0] = null;
        // 暫存除交換節點以外可選擇放置VNF的節點
        let cacheComputeNode = [...Array(initComputeResource.length).keys()];
        cacheComputeNode.remove(selectGenePoint1);
        cacheComputeNode.remove(selectGenePoint2);
        // 預設突變成功
        let mutationStatus = true;
        if ((arraySum(mutationPeopleGene1) <= initComputeResource[selectGenePoint2]) && (arraySum(mutationPeopleGene2) <= initComputeResource[selectGenePoint1])) {
            // 基因交換(一維度陣列)
            // 基因直接交換
            mutationPeople[selectGenePoint1 + 1] = [...mutationPeopleGene2];
            mutationPeople[selectGenePoint2 + 1] = [...mutationPeopleGene1];
            mutationStatus = true;
        } else if (arraySum(mutationPeopleGene1) <= initComputeResource[selectGenePoint2]) {
            // 基因交換(一維度陣列)
            // Point1直接放入Point2
            // Point2需逐一放入Point1，並另選節點放入剩餘細胞
            mutationPeople[selectGenePoint1 + 1] = [];
            mutationPeople[selectGenePoint2 + 1] = [...mutationPeopleGene1];
            mutationStatus = true;
            let fixGene = [];
            while (mutationPeopleGene2.length != 0) {
                // 隨機選擇VNF
                let selectCellPoint = Math.floor(Math.random() * mutationPeopleGene2.length);
                let cell = mutationPeopleGene2[selectCellPoint];
                if ((arraySum(mutationPeople[selectGenePoint1 + 1]) + cell) <= initComputeResource[selectGenePoint1]) {
                    mutationPeople[selectGenePoint1 + 1].push(cell);
                    // 扣掉以用空間
                    initComputeResource[selectGenePoint1] = initComputeResource[selectGenePoint1] - cell;
                } else {
                    fixGene.push(cell);
                }
                // mutationPeopleGene2中的VNF處理完成
                mutationPeopleGene2.remove(cell);
            }

            while (mutationStatus && fixGene.length != 0) {
                let cell = fixGene.shift();
                let copyCacheComputeNode = [...cacheComputeNode];
                // 從候選Node中挑出可放置VNF的Node
                let cacheNode = [];
                for (let i = 0; i < copyCacheComputeNode.length; i++) {
                    let selectNode = copyCacheComputeNode[i];
                    if ((arraySum(mutationPeople[selectNode + 1]) + cell) <= initComputeResource[selectNode]) {
                        cacheNode.push(selectNode);
                    }
                }
                // fixGene已經沒Node放的下，代表突變失敗
                if(cacheNode.length == 0){
                    mutationStatus = false;
                }
                // 將VNF嘗試放入候選節點
                while (cacheNode.length != 0) {
                    // 隨機選擇候選Node
                    let selectPoint = Math.floor(Math.random() * cacheNode.length);
                    let addGeneNode = cacheNode[selectPoint];
                    if ((arraySum(mutationPeople[addGeneNode + 1]) + cell) <= initComputeResource[addGeneNode]) {
                        mutationPeople[addGeneNode + 1].push(cell);
                        mutationStatus = true;
                        cacheNode.length = 0;
                    } else {
                        mutationStatus = false;
                        cacheNode.remove(addGeneNode);
                    }
                }
            }
        } else if (arraySum(mutationPeopleGene2) <= initComputeResource[selectGenePoint1]) {
            // 基因交換(一維度陣列)
            // Point2直接放入Point1
            // Point1需逐一放入Point2，並另選節點放入剩餘細胞
            mutationPeople[selectGenePoint1 + 1] = [...mutationPeopleGene2];
            mutationPeople[selectGenePoint2 + 1] = [];
            mutationStatus = true;
            let fixGene = [];
            while (mutationPeopleGene1.length != 0) {
                // 隨機選擇VNF
                let selectCellPoint = Math.floor(Math.random() * mutationPeopleGene1.length);
                let cell = mutationPeopleGene1[selectCellPoint];
                if ((arraySum(mutationPeople[selectGenePoint2 + 1]) + cell) <= initComputeResource[selectGenePoint2]) {
                    mutationPeople[selectGenePoint2 + 1].push(cell);
                    // 扣掉以用空間
                    initComputeResource[selectGenePoint2] = initComputeResource[selectGenePoint2] - cell;
                } else {
                    fixGene.push(cell);
                }
                // mutationPeopleGene1中的VNF處理完成
                mutationPeopleGene1.remove(cell);
            }

            while (mutationStatus && fixGene.length != 0) {
                let cell = fixGene.shift();
                let copyCacheComputeNode = [...cacheComputeNode];
                // 從候選Node中挑出可放置VNF的Node
                let cacheNode = [];
                for (let i = 0; i < copyCacheComputeNode.length; i++) {
                    let selectNode = copyCacheComputeNode[i];
                    if ((arraySum(mutationPeople[selectNode + 1]) + cell) <= initComputeResource[selectNode]) {
                        cacheNode.push(selectNode);
                    }
                }
                // fixGene已經沒Node放的下，代表突變失敗
                if(cacheNode.length == 0){
                    mutationStatus = false;
                }
                // 將VNF嘗試放入候選節點
                while (cacheNode.length != 0) {
                    // 隨機選擇候選Node
                    let selectPoint = Math.floor(Math.random() * cacheNode.length);
                    let addGeneNode = cacheNode[selectPoint];
                    if ((arraySum(mutationPeople[addGeneNode + 1]) + cell) <= initComputeResource[addGeneNode]) {
                        mutationPeople[addGeneNode + 1].push(cell);
                        mutationStatus = true;
                        cacheNode.remove(addGeneNode);
                        cacheNode.length = 0;
                    } else {
                        mutationStatus = false;
                        cacheNode.remove(addGeneNode);
                    }
                }
            }
        }
        if (mutationStatus) {
            mutationPeople[0][0] = this.geneScore(mutationPeople);
            copulationData[selectPeople] = twoDimensionalArrayCopy(mutationPeople);
            if (!this.check(threeDimensionalArrayCopy([mutationPeople]))) {
                console.log(`基因突變檢查:${color.red("失敗")}`);
                return false;
            }
            return copulationData;
        }else{
            return false;
        }        
    }

    check(data) {
        for (let i = 0; i < data.length; i++) {
            let catchVNF = [];
            // 檢查資源是否超出用量
            for (let j = 1; j <= this.compute.length; j++) {
                let vnfUsageResource = arraySum(data[i][j]);
                if (vnfUsageResource > this.compute[j - 1]) {
                    return false;
                }
                catchVNF = catchVNF.concat(data[i][j]);
            }
            // 檢查是否全部VNF都被放入
            if (arrayFilter(this.vnf, catchVNF).length != 0) {
                console.log(catchVNF);
                return false;
            }
        }
        return true;
    }
}

module.exports = GA;