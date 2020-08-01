/**
 * work node CPU 數量
 * @return {data.result[].metric.node} Work Node Name
 * @return {data.result[].value[1]} CPU數量
 */
const node_num_cpu = () => {
    return(`node:node_num_cpu:sum`)
}

const node_memory_MemAvailable_bytes = () => {
    return(`node_memory_MemAvailable_bytes`)
}

/**
 * 取得Kubernetes Cluster中Node內Pod數量
 * @return {data.result[].metric.node} 主機名稱
 * @return {data.result[].value[0]} 時間
 * @return {data.result[].value[1]} Pod數量
 */
const node_info = () => {
    return (`
        sum(\
            kube_pod_info{\
                cluster=""}\
            ) by (node)
    `)
}

/**
 * 取得Kubernetes Cluster中Node內Pod名稱
 * @return {data.result[].metric.node} 主機名稱
 * @return {data.result[].value[0]} 時間
 * @return {data.result[].value[1]} Pod數量
 */
const node_pod_info = (node) => {
    return (`
        node_namespace_pod:kube_pod_info:{node="${node}"}
    `)
}

/**
 * 取得Kubernetes Cluster中namespace資訊
 * @return {data.result[].metric.namespace:} namespace名稱
 * @return {data.result[].value[0]} 時間
 * @return {data.result[].value[1]} Pod數量
 */
const namespace_info = () => {
    return (`
        sum(\
            kube_pod_info{\
                cluster=""}\
            ) by (namespace)
    `)
}

/**
 * 取得Kubernetes Cluster中pod資訊
 * @return {data.result[].metric.namespace:} pod名稱
 * @return {data.result[].value[0]} 時間
 * @return {data.result[].value[1]} Pod數量
 */
const pod_info = () => {
    return (`
        sum(\
            kube_pod_info{\
                cluster=""}\
            ) by (node, pod)
    `)
}


module.exports = {
    node_num_cpu,
    node_memory_MemAvailable_bytes,
    node_info,
    node_pod_info,
    namespace_info,
    pod_info
}