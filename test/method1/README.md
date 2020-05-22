# Method 1
> 資源使用門檻0.8
1. 節點能力

| 節點     |CPU | Memory      |預設節點|
|---------|----|-------------|-------|
| titan2  | 8  | 32604413952 |       |
| titan4  | 8  | 15390060544 | O     |
| titan5  | 8  | 15850348544 |       |
2. 啟用節點
titan2、titan4、titan5
3. VNF資源request

| VNF     |CPU |
|---------|----|
| vnf2-1  | 2  |
| vnf2-2  | 2  |
| vnf2-3  | 2  |
| vnf2-4  | 2  |
| vnf2-5  | 2  |
| vnf2-6  | 2  |
4. VNF初始放置位置
> let testNode = ['titan4', 'titan4', 'titan2', 'titan2', 'titan5', 'titan5'];

| 節點     |VNF            |預設節點|
|---------|---------------|-------|
| titan2  | vnf2-1、vnf2-2 |       |
| titan4  | vnf2-3、vnf2-4 | O     |
| titan5  | vnf2-5、vnf2-6 |       |
5. 優化後結果

| 節點     |VNF                     |預設節點|
|---------|------------------------|-------|
| titan2  | vnf2-1、vnf2-2、vnf2-5  |       |
| titan4  | vnf2-3、vnf2-4、vnf2-6  | O     |
| titan5  |                        | 關閉   |