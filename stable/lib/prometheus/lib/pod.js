/**
 * Pod 資訊
 * @return {data.result[].metric.node} Work Node Name
 * @return {data.result[].value[1]} CPU數量
 */
const pod_info = (pod) => {
    return(`kube_pod_info{
        pod="${pod}"
    }`);
}

module.exports = {
    pod_info
}