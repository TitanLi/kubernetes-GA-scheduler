/**
 * Pod CPU 資源使用總和
 * Kubernetes/Compute Resources/Namespace(Pod)
 * @param {Pod name} pod
 * 單位：vCPU/Core 數量
 */
const pod_cpu_usage_seconds = (pod) => {
    return (`
        sum(\
            rate(\
                container_cpu_usage_seconds_total{\
                    job="kubelet",
                    cluster="",
                    image!="",
                    pod=~"${pod}",
                    container!="POD"
                }[5m])\
            )by(pod,node)
    `);
}

/**
 * Pod CPU 需求資源
 * Kubernetes/Compute Resources/Node(Pod)
 * @param {Pod name} pod
 * 單位：vCPU/Core 數量
 */
const pod_resource_requests_cpu_cores = (pod) => {
    return(`
            kube_pod_container_resource_requests_cpu_cores{\
                pod="${pod}"}
    `);
}

/**
 * Pod CPU 上限資源
 * Kubernetes/Compute Resources/Node(Pod)
 * @param {Pod name} pod
 * 單位：vCPU/Core 數量
 */
const pod_resource_limits_cpu_cores = (pod) => {
    return(`
        sum(\
            kube_pod_container_resource_limits_cpu_cores{\
                cluster="",\
                pod="${pod}"}\
            ) by (pod)
    `);
}

module.exports = {
    pod_cpu_usage_seconds,
    pod_resource_requests_cpu_cores,
    pod_resource_limits_cpu_cores
}