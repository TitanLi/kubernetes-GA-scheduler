/**
 * Pod memory 資源使用總和
 * Kubernetes/Compute Resources/Namespace(Pod)
 * @param {Pod name} pod
 * 單位：bytes
 */
const pod_memory_usage_bytes = (pod) => {
    return (`
        sum(\
            container_memory_working_set_bytes{\
                cluster="",\
                pod="${pod}",\
                container=~""}\
            ) by(pod,node) 
    `)
}

/**
 * Pod memory 需求資源
 * Kubernetes/Compute Resources/Node(Pod)
 * @param {Pod name} pod
 * 單位：bytes
 */
const pod_resource_requests_memory_bytes = (pod) => {
    return (`
            kube_pod_container_resource_requests_memory_bytes{\
                pod="${pod}"}\
    `);
}

/**
 * Pod memory 上限資源
 * Kubernetes/Compute Resources/Node(Pod)
 * @param {Pod name} pod
 * 單位：bytes
 */
const pod_resource_limits_memory_bytes = (pod) => {
    return (`
        sum(\
            kube_pod_container_resource_limits_memory_bytes{\
                cluster="",\
                pod="${pod}"}\
            ) by (pod)
    `)
}
module.exports = {
    pod_memory_usage_bytes,
    pod_resource_requests_memory_bytes,
    pod_resource_limits_memory_bytes
}