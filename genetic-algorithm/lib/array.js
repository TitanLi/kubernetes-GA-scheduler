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

// 複製三維陣列至新的記憶體位置
const threeDimensionalArrayCopy = (currentArray) => {
    let newArray = currentArray.map(function (arr1) {
        let newArray1 = arr1.map(function (arr2) {
            return [...arr2]
        });
        return [...newArray1];
    });
    return newArray;
}

// 複製二維陣列至新的記憶體位置
const twoDimensionalArrayCopy = function (currentArray) {
    let newArray = currentArray.map(function (arr) {
        return arr.slice();
    });
    return newArray;
}

// 陣列比較
const arrayCompare = function (arr1, arr2) {
    return JSON.stringify(arr1.sort()) == JSON.stringify(arr2.sort());
}

// arr1與arr2比較，在arr1中去除在arr2中重複項
// arr1 = [1, 2, 3, 4];
// arr2 = [3, 4, 5, 6];
// [1, 2];
const arrayFilter = function (arr1, arr2) {
    let arrResult = [...arr1];
    for (let i = 0; i < arr2.length; i++) {
        arrResult.remove(arr2[i]);
    }
    return arrResult;
}

// 在arr中找出是否包含元素
const arrayFind = function (arr, data) {
    // console.log(arr);
    let found = arr.find(element => element == data);
    return found == undefined ? false : true;
}

// 三維陣列依照第一個元素進行排序
const threeDimensionalArraySortByFirstElement = function (a, b) {
    if (a[0][0] > b[0][0]) return 1;
    if (b[0][0] > a[0][0]) return -1;
    return 0;
}

// 二維陣列依照第一個元素進行排序
const twoDimensionalArraySortBySecondElement = function (a, b) {
    if (a[1] > b[1]) return 1;
    if (b[1] > a[1]) return -1;
    return 0;
}

// 一維陣列總和
const arraySum = function (data) {
    let array = [...data]
    if(array.length == 0){
        return 0;
    }
    return array.reduce((accumulator, currentValue) => Number(accumulator + currentValue));
}

module.exports = {
    twoDimensionalArrayCopy,
    threeDimensionalArrayCopy,
    arrayCompare,
    arrayFilter,
    arrayFind,
    arraySum,
    threeDimensionalArraySortByFirstElement,
    twoDimensionalArraySortBySecondElement
}