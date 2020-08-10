const color = require('colors');
const { strip } = require('./../lib/num.js');
const { twoDimensionalArrayCopy, threeDimensionalArrayCopy, arrayCompare, arrayFilter, arrayFind, arraySum } = require('./../lib/array.js');
const Migrate = require('./../../lib/migrate.js');
const migrate = new Migrate();
class GA {
    constructor(clusterMasterWorkNodeNum, compute, vnf, initPopulationSize, currentPodPlacement, maybeTurnOffNodeNum = 0) {
        // 叢集Master Node編號
        this.clusterMasterWorkNodeNum = clusterMasterWorkNodeNum;
        // 為Worker Node編號由0~N-1
        this.compute = [...Array(compute.length).keys()];
        // 可用Worker Node資源列表
        this.computeResource = compute;
        // 為VNF編號由1~N
        this.vnf = [...Array(vnf.length).keys()].map((data) => data + 1);
        // VNF所需資源列表
        this.vnfUsaged = vnf;
        // 人口母體集合大小
        this.initPopulationSize = initPopulationSize;
        // 取出預計關閉Worker Node上方的VNF編號
        if (maybeTurnOffNodeNum != undefined) {
            this.maybeTurnOffNodeVnfNum = currentPodPlacement.splice(maybeTurnOffNodeNum, 1);
        }
    }

    /**
     * 染色體給予評分
     * 
     * @param {Two Dimensional Array} data 染色體
     * 
     * @returns {Number} ans 染色體分數
     */
    geneScore(data) {
        let vnfUsaged = twoDimensionalArrayCopy(this.vnfUsaged);
        let scoreCPU = 0;
        let scoreRAM = 0;
        let runNode = 0;
        let usageRate = 0;
        let energy = 0
        let ans = 0;
        let workNodeMasterScore = 0;
        // 依照Worker Node數量為染色體評分
        for (let j = 1; j <= this.compute.length; j++) {
            // 依序取出Worker Node
            let node = data[j];
            // 暫存單個Node上VNF的CPU和RAM用量
            let nodeVnfUsageCPU = [];
            let nodeVnfUsageRAM = [];
            for (let vnf = 0; vnf < node.length; vnf++) {
                nodeVnfUsageCPU.push(vnfUsaged[node[vnf] - 1][0]);
                nodeVnfUsageRAM.push(vnfUsaged[node[vnf] - 1][1]);
            }
            if (data[j].length > 0) {
                // 計算CPU利用率
                // scoreCPU = strip(scoreCPU + strip(arraySum(nodeVnfUsageCPU) / this.computeResource[j - 1][0]));
                scoreCPU = strip(scoreCPU + strip(this.computeResource[j - 1][0] - arraySum(nodeVnfUsageCPU)));
                // 計算RAM利用率
                // scoreRAM = strip(scoreRAM + strip(arraySum(nodeVnfUsageRAM) / this.computeResource[j - 1][1]));
                scoreRAM = strip(scoreRAM + Math.floor(strip(strip(this.computeResource[j - 1][1] - arraySum(nodeVnfUsageRAM)) / 1073741820)));
                runNode = runNode + 1;
                // 消耗
                if (arraySum(nodeVnfUsageCPU) >= 4) {
                    energy = strip(energy + 0.9);
                } else {
                    energy = strip(energy + (0.388 + (arraySum(nodeVnfUsageCPU) / 4) * 0.512));
                }
            }
            // 主Worker Node閒置
            if ((j == this.clusterMasterWorkNodeNum + 1) && (node.length == 0)) {
                workNodeMasterScore = strip(this.computeResource[j - 1][0] + Math.floor(strip(this.computeResource[j - 1][1] / 1073741820)));
            }
        }
        // 計算VNF遷移成本
        let renew = twoDimensionalArrayCopy(data);
        renew.shift();
        let migrationCost = migrate.migrationCost(this.maybeTurnOffNodeVnfNum, renew).cost;
        // 使用結點數越少分數越高
        usageRate = runNode;
        ans = Number((scoreCPU + scoreRAM + usageRate + migrationCost + workNodeMasterScore + energy).toFixed(2));
        return ans;
    }

    /**
     * 為初始化基因給予評分
     * 
     * @param {Three Dimensional Array} data 染色體母體集合
     * 
     * @returns {Three Dimensional Array} geneScoreResult 染色體母體集合
     */
    getScore(data) {
        // 依序對染色體評分
        let geneScoreResult = threeDimensionalArrayCopy(data);
        for (let i = 0; i < geneScoreResult.length; i++) {
            geneScoreResult[i][0][0] = this.geneScore(geneScoreResult[i]);
        }
        return geneScoreResult;
    }

    /**
     * 初始化人口
     * 
     * 染色體母體集合初始化成功
     * @returns {Three Dimensional Array} initPopulation 染色體母體集合
     * 染色體母體集合初始化失敗
     * @returns {Boolean} false
     */
    initPopulation() {
        // 初始化基因陣列
        let initPopulation = new Array(this.initPopulationSize);
        // 在基因大小中新增計算節點維度
        for (let i = 0; i < initPopulation.length; i++) {
            // 新增計算維度
            initPopulation[i] = new Array(this.compute.length + 1);
            initPopulation[i][0] = [null];
            // 在計算節點中新增放置空間
            for (let j = 1; j <= this.compute.length; j++) {
                // 新增維度
                initPopulation[i][j] = new Array(0);
            }
        }
        // 為初始化基因陣列隨機填值
        let initCount = 0;
        for (let i = 0; i < this.initPopulationSize; i++) {
            // 初始化變數
            let initCompute = [...this.compute];
            let initVNF = [...this.vnf];
            let initComputeResource = twoDimensionalArrayCopy(this.computeResource);
            let initVnfUsaged = twoDimensionalArrayCopy(this.vnfUsaged);
            let vnfSelect = true;
            let selectVNF;
            let catchCompute = [];
            initCount++;
            if (initCount > (this.compute.length * 10)) {
                // 代表初始化基因失敗無法將VNF全部放入
                return false;
            }
            // 產生染色體
            while (initVNF.length != 0) {
                // 判斷是否隨機選擇VNF
                if (vnfSelect) {
                    // 隨機選擇VNF進行放置
                    selectVNF = initVNF[Math.floor(Math.random() * initVNF.length)];
                    // 暫存單次VNF放置演算法還可嘗試的放置位置
                    catchCompute = [...Array(initCompute.length).keys()];
                }
                // 隨機選擇VNF放置Worker Node
                let selectCatchComputePoint = Math.floor(Math.random() * catchCompute.length);
                let setPosition = catchCompute[selectCatchComputePoint];
                // 確認選擇到的物品是否可放入計算節點
                if ((initVnfUsaged[selectVNF - 1][0] <= initComputeResource[setPosition][0]) && (initVnfUsaged[selectVNF - 1][1] <= initComputeResource[setPosition][1])) {
                    // 將資料放入相對應位子當作初始化基因
                    initPopulation[i][setPosition + 1].push(selectVNF);
                    // 更新計算節點剩餘資源
                    // CPU
                    initComputeResource[setPosition][0] = initComputeResource[setPosition][0] - initVnfUsaged[selectVNF - 1][0];
                    // RAM
                    initComputeResource[setPosition][1] = initComputeResource[setPosition][1] - initVnfUsaged[selectVNF - 1][1];
                    initVNF.remove(selectVNF);
                    // 放置成功選擇新的VNF
                    vnfSelect = true;
                } else {
                    // VNF嘗試放置所選位置失敗，將該位置剔除，選擇新的位置
                    vnfSelect = false;
                    // 將無法放入該VNF的Node從候選節點中移除
                    catchCompute.remove(setPosition);
                    // 當所有節點剩餘資源皆無法放置VNF時代表本次初始化基因失敗需重新放置
                    if (catchCompute.length == 0) {
                        vnfSelect = true;
                        // 重置基因
                        for (let j = 1; j <= this.compute.length; j++) {
                            initPopulation[i][j] = new Array(0);
                        }
                        initVNF.length = 0;
                        i--;
                    }
                }
            }
        }
        console.log(`基因檢查:${(this.check(threeDimensionalArrayCopy(initPopulation))) ? color.green("成功") : color.red("失敗")}`);
        return threeDimensionalArrayCopy(initPopulation);
    }

    /**
     * 基因交配
     * 
     * @param {Three Dimensional Array} data 染色體母體集合
     * 
     * 交配成功
     * @returns {Three Dimensional Array} copulationData 染色體母體集合
     * 交配失敗
     * @returns {Boolean} copulationStatus false
     */
    copulation(data) {
        // 複製人口母體集合(三維陣列)
        let copulationData = threeDimensionalArrayCopy(data);
        // 用於比較輸出結果是否有超過Compute能力
        let initComputeResource = [...this.computeResource];
        // 用於計算資源使用量是否超標
        let vnfUsaged = twoDimensionalArrayCopy(this.vnfUsaged);
        // 隨機選擇要交換的基因位置
        let genePoint = Math.floor(Math.random() * initComputeResource.length);
        // 隨機選擇要交換的基因組
        let peopleSelection1 = Math.floor(Math.random() * copulationData.length);
        let peopleSelection2 = Math.floor(Math.random() * copulationData.length);
        // 父基因與母基因(二維度陣列)
        let father = twoDimensionalArrayCopy(copulationData[peopleSelection1]);
        let mother = twoDimensionalArrayCopy(copulationData[peopleSelection2]);
        // 將染色體分數設為Null
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
            // 比較父母基因內容是否相同，若相同則不進行交配
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
                // 暫存除交配節點以外可選擇放置VNF的節點
                let cacheComputeNode = [...Array(initComputeResource.length).keys()];
                cacheComputeNode.remove(genePoint);
                // 處理deduplicationFatherGen
                if (copulationStatus) {
                    for (let j = 0; j < deduplicationFatherGen.length; j++) {
                        // 刪除父親重複VNF
                        let cell = deduplicationFatherGen[j];
                        // 暫存含有重複VNF的Node
                        let cacheDeduplicationGene = [];
                        // 假設基因交配成功
                        copulationStatus = true;
                        // 找出包含父親重複VNF基因
                        for (let deduplication = 1; deduplication <= initComputeResource.length; deduplication++) {
                            if (deduplication != (genePoint + 1)) {
                                let fatherGene = [...father[deduplication]];
                                if (arrayFind(fatherGene, cell)) {
                                    cacheDeduplicationGene.push(deduplication);
                                }
                            }
                        }
                        // 隨機需選擇候選節點刪除重複VNF
                        let selectDeleteDeduplicationGene = cacheDeduplicationGene[Math.floor(Math.random() * cacheDeduplicationGene.length)];
                        // 刪除(一維度陣列)
                        father[selectDeleteDeduplicationGene] = arrayFilter(father[selectDeleteDeduplicationGene], [cell]);

                        // 加入母親欠缺基因
                        // 複製暫存可用節點不包括交換節點
                        let copyCacheComputeNode = [...cacheComputeNode];
                        while (copyCacheComputeNode.length != 0) {
                            // 隨機選出候選節點
                            let selectPoint = Math.floor(Math.random() * copyCacheComputeNode.length);
                            let addGenePoint = copyCacheComputeNode[selectPoint];
                            // 計算選到的Worker Node上VNF的CPU和RAM使用量
                            // mother二維陣列
                            let nodeVnfUsageCPU = [];
                            let nodeVnfUsageRAM = [];
                            for (let vnf = 0; vnf < mother[addGenePoint + 1].length; vnf++) {
                                nodeVnfUsageCPU.push(vnfUsaged[mother[addGenePoint + 1][vnf] - 1][0]);
                                nodeVnfUsageRAM.push(vnfUsaged[mother[addGenePoint + 1][vnf] - 1][1]);
                            }
                            // 判斷新增基因加入後是否超出節點負載
                            if ((arraySum(nodeVnfUsageCPU) + vnfUsaged[cell - 1][0]) <= initComputeResource[addGenePoint][0] &&
                                (arraySum(nodeVnfUsageRAM) + vnfUsaged[cell - 1][1]) <= initComputeResource[addGenePoint][1]) {
                                mother[addGenePoint + 1].push(cell);
                                // 預設基因交配成功
                                copulationStatus = true;
                                // 將可嘗試放入的Worker Node列表清空
                                copyCacheComputeNode = [];
                            } else {
                                // 預設基因交配失敗
                                copulationStatus = false;
                                // 將該Worker Node移出可嘗試Worker Node列表
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
                        // 刪除母親重複VNF
                        let cell = deduplicationMotherGen[j];
                        // 暫存含有重複VNF的Node
                        let cacheDeduplicationGene = [];
                        // 假設基因交配成功
                        copulationStatus = true;
                        // 找出母親重複VNF基因
                        for (let deduplication = 1; deduplication <= initComputeResource.length; deduplication++) {
                            if (deduplication != (genePoint + 1)) {
                                let motherGene = [...mother[deduplication]];
                                if (arrayFind(motherGene, cell)) {
                                    cacheDeduplicationGene.push(deduplication);
                                }
                            }
                        }
                        // 隨機選擇候選節點刪除重複VNF
                        let selectDeleteDeduplicationGene = cacheDeduplicationGene[Math.floor(Math.random() * cacheDeduplicationGene.length)];
                        // 刪除(一維度陣列)
                        mother[selectDeleteDeduplicationGene] = arrayFilter(mother[selectDeleteDeduplicationGene], [cell]);

                        // 加入父親欠缺基因
                        // 複製暫存可用節點不包括交換節點
                        let copyCacheComputeNode = [...cacheComputeNode];
                        while (copyCacheComputeNode.length != 0) {
                            // 隨機選出候選節點
                            let selectPoint = Math.floor(Math.random() * copyCacheComputeNode.length);
                            let addGenePoint = copyCacheComputeNode[selectPoint];
                            // 計算Worker Node上VNF的CPU和RAM使用量
                            // mother二維陣列
                            let nodeVnfUsageCPU = [];
                            let nodeVnfUsageRAM = [];
                            for (let vnf = 0; vnf < father[addGenePoint + 1].length; vnf++) {
                                nodeVnfUsageCPU.push(vnfUsaged[father[addGenePoint + 1][vnf] - 1][0]);
                                nodeVnfUsageRAM.push(vnfUsaged[father[addGenePoint + 1][vnf] - 1][1]);
                            }
                            // 判斷新增基因加入後是否超出節點負載
                            if ((arraySum(nodeVnfUsageCPU) + vnfUsaged[cell - 1][0]) <= initComputeResource[addGenePoint][0] &&
                                (arraySum(nodeVnfUsageRAM) + vnfUsaged[cell - 1][1]) <= initComputeResource[addGenePoint][1]) {
                                father[addGenePoint + 1].push(cell);
                                // 預設基因交配成功
                                copulationStatus = true;
                                // 將可嘗試放入的Worker Node列表清空
                                copyCacheComputeNode = [];
                            } else {
                                // 預設基因交配失敗
                                copulationStatus = false;
                                // 將該Worker Node移出可嘗試Worker Node列表
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

                // 挑選好的染色體放入染色體母體集合
                if (copulationStatus) {
                    // 父親基因與前代基因選好的
                    // 計算染色體分數
                    let fatherGeneScore = this.geneScore(father);
                    // 染色體分數越小代表染色體越好
                    if (fatherGeneScore <= copulationData[peopleSelection1][0][0]) {
                        father[0][0] = fatherGeneScore;
                        copulationData[peopleSelection1] = twoDimensionalArrayCopy(father);
                    } else {
                        copulationData[peopleSelection1] = twoDimensionalArrayCopy(originFatherGen);
                    }
                    // 母親基因與前代基因選好的
                    // 計算染色體分數
                    let motherGeneScore = this.geneScore(mother);
                    // 染色體分數越小代表染色體越好
                    if (motherGeneScore <= copulationData[peopleSelection2][0][0]) {
                        mother[0][0] = motherGeneScore;
                        copulationData[peopleSelection2] = twoDimensionalArrayCopy(mother);
                    } else {
                        copulationData[peopleSelection2] = twoDimensionalArrayCopy(originMotherGen);
                    }
                    // 基因檢查
                    if (!this.check(threeDimensionalArrayCopy([copulationData[peopleSelection1]]))) {
                        console.log(`父基因檢查:${color.red("失敗")}`);
                        return false;
                    }
                    if (!this.check(threeDimensionalArrayCopy([copulationData[peopleSelection2]]))) {
                        console.log(`母基因檢查:${color.red("失敗")}`);
                        return false;
                    }
                }
            }
        }
        return threeDimensionalArrayCopy(copulationData);
    }

    /**
     * 基因變異
     * 
     * @param {Three Dimensional Array} data 染色體母體集合
     * 
     * 交配成功
     * @returns {Three Dimensional Array} copulationData 染色體母體集合
     * 交配失敗
     * @returns {Boolean} copulationStatus false
     */
    mutation(data) {
        // 複製人口母體集合(三維陣列)
        let copulationData = threeDimensionalArrayCopy(data);
        // 用於比較輸出結果是否有超過Compute能力
        let initComputeResource = [...this.computeResource];
        // 用於計算資源使用量是否超標
        let vnfUsaged = twoDimensionalArrayCopy(this.vnfUsaged);
        // 隨機選擇要突變的人口
        let selectPeople = Math.floor(Math.random() * copulationData.length);
        // 隨機選擇要交換的基因位置
        let selectGenePoint1 = Math.floor(Math.random() * initComputeResource.length);
        let selectGenePoint2 = Math.floor(Math.random() * initComputeResource.length);
        // 父基因與母基因(二維度陣列)
        let mutationPeople = twoDimensionalArrayCopy(copulationData[selectPeople]);
        let mutationPeopleGene1 = [...mutationPeople[selectGenePoint1 + 1]];
        let mutationPeopleGene2 = [...mutationPeople[selectGenePoint2 + 1]];
        // 將分數設為Null
        mutationPeople[0][0] = null;
        // 暫存除突變節點以外可選擇放置VNF的節點
        let cacheComputeNode = [...Array(initComputeResource.length).keys()];
        cacheComputeNode.remove(selectGenePoint1);
        cacheComputeNode.remove(selectGenePoint2);
        // 預設突變成功
        let mutationStatus = true;
        // 計算Worker Node上VNF的CPU和RAM使用量
        let nodeVnfUsageCPU_Gene1 = [];
        let nodeVnfUsageRAM_Gene1 = [];
        let nodeVnfUsageCPU_Gene2 = [];
        let nodeVnfUsageRAM_Gene2 = [];
        for (let vnf = 0; vnf < mutationPeopleGene1.length; vnf++) {
            nodeVnfUsageCPU_Gene1.push(vnfUsaged[mutationPeopleGene1[vnf] - 1][0]);
            nodeVnfUsageRAM_Gene1.push(vnfUsaged[mutationPeopleGene1[vnf] - 1][1]);
        }
        for (let vnf = 0; vnf < mutationPeopleGene2.length; vnf++) {
            nodeVnfUsageCPU_Gene2.push(vnfUsaged[mutationPeopleGene2[vnf] - 1][0]);
            nodeVnfUsageRAM_Gene2.push(vnfUsaged[mutationPeopleGene2[vnf] - 1][1]);
        }
        if ((arraySum(nodeVnfUsageCPU_Gene1) <= initComputeResource[selectGenePoint2][0]) &&
            (arraySum(nodeVnfUsageRAM_Gene1) <= initComputeResource[selectGenePoint2][1]) &&
            (arraySum(nodeVnfUsageCPU_Gene2) <= initComputeResource[selectGenePoint1][0]) &&
            (arraySum(nodeVnfUsageRAM_Gene2) <= initComputeResource[selectGenePoint1][1])) {
            // 基因交換(一維度陣列)
            // 基因直接交換
            mutationPeople[selectGenePoint1 + 1] = [...mutationPeopleGene2];
            mutationPeople[selectGenePoint2 + 1] = [...mutationPeopleGene1];
            // 假設突變成功
            mutationStatus = true;
        } else if ((arraySum(nodeVnfUsageCPU_Gene1) <= initComputeResource[selectGenePoint2][0]) &&
            (arraySum(nodeVnfUsageRAM_Gene1) <= initComputeResource[selectGenePoint2][1])) {
            // 基因交換(一維度陣列)
            // Point1直接放入Point2
            // Point2需逐一隨機選擇VNF放入Point1，將無法順利放入的VNF放入突變點以外的Worker Node
            mutationPeople[selectGenePoint1 + 1] = [];
            mutationPeople[selectGenePoint2 + 1] = [...mutationPeopleGene1];
            // 假設突變成功
            mutationStatus = true;
            // 無法順利放入的VNF儲存列表
            let fixGene = [];
            // 處理Point2需逐一隨機選擇VNF放入Point1
            while (mutationPeopleGene2.length != 0) {
                // 隨機選擇VNF
                let selectCellPoint = Math.floor(Math.random() * mutationPeopleGene2.length);
                let cell = mutationPeopleGene2[selectCellPoint];
                // 計算Worker Node上VNF的CPU和RAM使用量
                let selectPointVnfUsageCPU = [];
                let selectPointVnfUsageRAM = [];
                for (let vnf = 0; vnf < mutationPeople[selectGenePoint1 + 1].length; vnf++) {
                    selectPointVnfUsageCPU.push(vnfUsaged[mutationPeople[selectGenePoint1 + 1][vnf] - 1][0]);
                    selectPointVnfUsageRAM.push(vnfUsaged[mutationPeople[selectGenePoint1 + 1][vnf] - 1][1]);
                }
                // 如果VNF可放入目標Worker Node
                if (((arraySum(selectPointVnfUsageCPU) + vnfUsaged[cell - 1][0]) <= initComputeResource[selectGenePoint1][0]) &&
                    ((arraySum(selectPointVnfUsageRAM) + vnfUsaged[cell - 1][1]) <= initComputeResource[selectGenePoint1][1])) {
                    mutationPeople[selectGenePoint1 + 1].push(cell);
                } else {
                    // VNF無法順利放入目標Worker Node，將其加入無法順利放入的VNF儲存列表
                    fixGene.push(cell);
                }
                // 將該VNF移出mutationPeopleGene2列表
                mutationPeopleGene2.remove(cell);
            }

            // 如果突變狀態為成功且無法順利放入的VNF儲存列表不為空
            while (mutationStatus && fixGene.length != 0) {
                // 逐一從無法順利放入的VNF儲存列表中取出VNF嘗試完成突變
                let cell = fixGene.shift();
                // 複製除突變節點以外可選擇放置VNF的節點
                let copyCacheComputeNode = [...cacheComputeNode];
                // 挑出可放置VNF的Worker Node
                let cacheNode = [];
                for (let i = 0; i < copyCacheComputeNode.length; i++) {
                    // 逐一選出Worker Node
                    let selectNode = copyCacheComputeNode[i];
                    // 計算Worker Node上VNF的CPU和RAM使用量
                    let selectPointVnfUsageCPU = [];
                    let selectPointVnfUsageRAM = [];
                    for (let vnf = 0; vnf < mutationPeople[selectNode + 1].length; vnf++) {
                        selectPointVnfUsageCPU.push(vnfUsaged[mutationPeople[selectNode + 1][vnf] - 1][0]);
                        selectPointVnfUsageRAM.push(vnfUsaged[mutationPeople[selectNode + 1][vnf] - 1][1]);
                    }
                    // 如果VNF可放入所選到的Worker Node
                    if (((arraySum(selectPointVnfUsageCPU) + vnfUsaged[cell - 1][0]) <= initComputeResource[selectNode][0]) &&
                        ((arraySum(selectPointVnfUsageRAM) + vnfUsaged[cell - 1][1]) <= initComputeResource[selectNode][1])) {
                        cacheNode.push(selectNode);
                    }
                }
                // fixGene已經沒Worker Node放的下，代表突變失敗
                if (cacheNode.length == 0) {
                    // 突變失敗
                    mutationStatus = false;
                } else {
                    // 隨機選擇候選Worker Node
                    let selectPoint = Math.floor(Math.random() * cacheNode.length);
                    let addGeneNode = cacheNode[selectPoint];
                    // 將VNF放入Worker Node
                    mutationPeople[addGeneNode + 1].push(cell);
                    // 假設突變成功
                    mutationStatus = true;
                    // 將可放置VNF的Worker Node列表清空
                    cacheNode.length = 0;
                }
            }
        } else if ((arraySum(nodeVnfUsageCPU_Gene2) <= initComputeResource[selectGenePoint1][0]) &&
            (arraySum(nodeVnfUsageRAM_Gene2) <= initComputeResource[selectGenePoint1][1])) {
            // 基因交換(一維度陣列)
            // Point2直接放入Point1
            // Point1需逐一隨機選擇VNF放入Point2，將無法順利放入的VNF放入突變點以外的Worker Node
            mutationPeople[selectGenePoint1 + 1] = [...mutationPeopleGene2];
            mutationPeople[selectGenePoint2 + 1] = [];
            // 假設突變成功
            mutationStatus = true;
            // 無法順利放入的VNF儲存列表
            let fixGene = [];
            // 處理Point1需逐一隨機選擇VNF放入Point2
            while (mutationPeopleGene1.length != 0) {
                // 隨機選擇VNF
                let selectCellPoint = Math.floor(Math.random() * mutationPeopleGene1.length);
                let cell = mutationPeopleGene1[selectCellPoint];
                // 計算Worker Node上VNF的CPU和RAM使用量
                let selectPointVnfUsageCPU = [];
                let selectPointVnfUsageRAM = [];
                for (let vnf = 0; vnf < mutationPeople[selectGenePoint2 + 1].length; vnf++) {
                    selectPointVnfUsageCPU.push(vnfUsaged[mutationPeople[selectGenePoint2 + 1][vnf] - 1][0]);
                    selectPointVnfUsageRAM.push(vnfUsaged[mutationPeople[selectGenePoint2 + 1][vnf] - 1][1]);
                }
                if (((arraySum(selectPointVnfUsageCPU) + vnfUsaged[cell - 1][0]) <= initComputeResource[selectGenePoint2][0]) &&
                    ((arraySum(selectPointVnfUsageRAM) + vnfUsaged[cell - 1][1]) <= initComputeResource[selectGenePoint2][1])) {
                    mutationPeople[selectGenePoint2 + 1].push(cell);
                } else {
                    // VNF無法順利放入目標Worker Node，將其加入無法順利放入的VNF儲存列表
                    fixGene.push(cell);
                }
                // 將該VNF移出mutationPeopleGene1列表
                mutationPeopleGene1.remove(cell);
            }
            // 如果突變狀態為成功且無法順利放入的VNF儲存列表不為空
            while (mutationStatus && fixGene.length != 0) {
                // 逐一從無法順利放入的VNF儲存列表中取出VNF嘗試完成突變
                let cell = fixGene.shift();
                // 複製除突變節點以外可選擇放置VNF的節點
                let copyCacheComputeNode = [...cacheComputeNode];
                // 從候選Node中挑出可放置VNF的Node
                let cacheNode = [];
                for (let i = 0; i < copyCacheComputeNode.length; i++) {
                    let selectNode = copyCacheComputeNode[i];
                    // 計算Worker Node上VNF的CPU和RAM使用量
                    let selectPointVnfUsageCPU = [];
                    let selectPointVnfUsageRAM = [];
                    for (let vnf = 0; vnf < mutationPeople[selectNode + 1].length; vnf++) {
                        selectPointVnfUsageCPU.push(vnfUsaged[mutationPeople[selectNode + 1][vnf] - 1][0]);
                        selectPointVnfUsageRAM.push(vnfUsaged[mutationPeople[selectNode + 1][vnf] - 1][1]);
                    }
                    if (((arraySum(selectPointVnfUsageCPU) + vnfUsaged[cell - 1][0]) <= initComputeResource[selectNode][0]) && ((arraySum(selectPointVnfUsageRAM) + vnfUsaged[cell - 1][1]) <= initComputeResource[selectNode][1])) {
                        cacheNode.push(selectNode);
                    }
                }
                // fixGene已經沒Worker Node放的下，代表突變失敗
                if (cacheNode.length == 0) {
                    mutationStatus = false;
                } else {
                    // 隨機選擇候選Worker Node
                    let selectPoint = Math.floor(Math.random() * cacheNode.length);
                    let addGeneNode = cacheNode[selectPoint];
                    // 將VNF放入Worker Node
                    mutationPeople[addGeneNode + 1].push(cell);
                    // 假設突變成功
                    mutationStatus = true;
                    // 將可放置VNF的Worker Node列表清空
                    cacheNode.length = 0;
                }
            }
        }
        // 如果突變狀態成功
        if (mutationStatus) {
            // 計算染色體分數
            mutationPeople[0][0] = this.geneScore(mutationPeople);
            // 將染色體更新回母體集合
            copulationData[selectPeople] = twoDimensionalArrayCopy(mutationPeople);
            // 檢查染色體
            if (!this.check(threeDimensionalArrayCopy([mutationPeople]))) {
                console.log(`基因突變檢查:${color.red("失敗")}`);
                return false;
            }
            return copulationData;
        } else {
            return false;
        }
    }

    /**
     * 
     * @param {Three Dimensional Array} data 染色體母體集合
     * 
     * 檢查成功
     * @returns {Boolean} true
     * 檢查失敗
     * @returns {Boolean} false
     */
    check(data) {
        // 逐一檢查染色體
        for (let i = 0; i < data.length; i++) {
            // 複製VNF所需資源列表
            let vnfUsaged = twoDimensionalArrayCopy(this.vnfUsaged);
            // 已被安排VNF列表
            let catchVNF = [];
            // 檢查資源是否超出用量
            for (let j = 1; j <= this.compute.length; j++) {
                // 取出Worker Node放置VNF的列表
                let node = data[i][j];
                // 計算Worker Node上VNF的CPU和RAM使用量
                let nodeVnfUsageCPU = [];
                let nodeVnfUsageRAM = [];
                for (let vnf = 0; vnf < node.length; vnf++) {
                    nodeVnfUsageCPU.push(vnfUsaged[node[vnf] - 1][0]);
                    nodeVnfUsageRAM.push(vnfUsaged[node[vnf] - 1][1]);
                }
                let nodeVnfUsageTotalCPU = arraySum(nodeVnfUsageCPU);
                let nodeVnfUsageTotalRAM = arraySum(nodeVnfUsageRAM);
                // 如果有Worker Node資源使用量過載
                if (nodeVnfUsageTotalCPU > this.computeResource[j - 1][0] || nodeVnfUsageTotalRAM > this.computeResource[j - 1][1]) {
                    console.log(color.red("有Node資源過度利用"));
                    return false;
                }
                catchVNF = catchVNF.concat(data[i][j]);
            }
            // 檢查是否全部VNF都被放入
            if (arrayFilter(this.vnf, catchVNF).length != 0) {
                console.log(color.red("有VNF沒被放入"));
                return false;
            }
        }
        return true;
    }
}

module.exports = GA;