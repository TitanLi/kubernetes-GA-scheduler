#!/bin/bash

SERVER='localhost:8080'

while true;
do
    for PODNAME in $(kubectl --server $SERVER get pods --all-namespaces -o json | jq '.items[] | select(.spec.schedulerName == "my-scheduler") | select(.spec.nodeName == null) | .metadata.name' | tr -d '"');
    do
	    NAMESPACES=($(kubectl --server $SERVER get pods --all-namespaces -o json | jq '.items[] | select(.spec.schedulerName == "my-scheduler") | select(.metadata.name == "'$PODNAME'") | .metadata.namespace' | tr -d '"'))
	    NODES=($(kubectl --server $SERVER get nodes -o json | jq '.items[].metadata.name' | tr -d '"'))
	    NUMNODES=${#NODES[@]}
        #CHOSEN=${NODES[$[$RANDOM % $NUMNODES]]}
	    CHOSEN=$(curl "http://localhost:3000/scheduler/$NAMESPACES/$PODNAME")
	    echo "$CHOSEN"
        if [ "$CHOSEN" != "wait" ] ; then
	        curl --header "Content-Type:application/json" --request POST --data '{"apiVersion":"v1", "kind": "Binding", "metadata": {"name": "'$PODNAME'"}, "target": {"apiVersion": "v1", "kind": "Node", "name": "'$CHOSEN'"}}' http://$SERVER/api/v1/namespaces/$NAMESPACES/pods/$PODNAME/binding/
            echo "Assigned $PODNAME to $CHOSEN in NAMESPACES:$NAMESPACES"
        fi
    done
    sleep 1
done