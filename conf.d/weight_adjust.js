export default { checkMetrics }

function checkMetrics() {
    const re = /^nv_inference_queue_duration_us\{model="resnet50",instance="resnet50_0"\}\s+([0-9.eE+-]+)\s*$/m;
    var metric_new, metric_old, weight;
    ngx.log(ngx.WARN, "START");
    ngx.fetch('http://127.0.0.1:8888/api/9/http/upstreams/triton_inference')
    .then(reply => reply.json())
    .then(u => {
        u.peers.forEach(function(peer) {
            ngx.log(ngx.WARN, "FOUND " + peer.server + " (" + peer.id + ") W=" + peer.weight);

            // Get previous metric for this peer
            metric_old = ngx.shared.peer_load.get(peer.server);
            if (!metric_old) {
                ngx.log(ngx.WARN, "NO PREVIOUS METRIC FOR " + peer.server)
                metric_old = 0;
            }

            // Get the current metric for this peer
            ngx.fetch('http://' + peer.server + '/metrics')
            .then(prom => prom.text())
            .then(p => {
                ngx.log(ngx.WARN, "GOT PROM FROM " + peer.server + "  (" + p.length + " bytes)");
                metric_new = p.match(re)[1];
                if (!metric_new) {
                    ngx.log(ngx.ERROR, "FAILED TO OBTAIN QUEUE LENGTH FOR " + peer.server);
                } else {
                    ngx.log(ngx.WARN, peer.server + " QUEUE WAS: " + metric_old / 1000 + " NOW: " + metric_new / 1000);  // Convert us to ms
                    ngx.shared.peer_load.set(peer.server, metric_new / 1000);
                    ngx.log(ngx.WARN, "ADJUSTING server " + peer.server + " id " + peer.id + " weight " + peer.weight + " old " + metric_old + " new " + metric_new);
                    adjustWeights(peer.id, peer.weight, metric_old, metric_new);
                }
            })}
    )})
    .catch(ngx.ERROR, e => ngx.log("API FETCH ERROR " + e.message));

    return 1;
}

function adjustWeights(serverid, pw, prev, curr) {
    const break_circuit_at = 10000000; // Take server out of service if queue
    const take_action_at   = 1000000; // Out of capacity, decrease weight

    var patch;
    var newWeight = 1;
    var weightFactor = 1;
    if (prev > curr) {
        weightFactor = 2; // Double the weight drop if capacity is falling
    }

    ngx.log(ngx.WARN, "OLD WEIGHT _____ " + pw);
    var oldWeight = pw;

    if (curr > break_circuit_at) {
        // Very bad - Cause the health check to fail, and set weight to floor to avoid thundering heard
        ngx.log(ngx.WARN, ' - FAILING ' + serverid + ', metric was ' + curr);
        patch = {down: true, weight: 1};
    } else if (curr > take_action_at) {
        // Out of capacity - decrease the weight of this server
        if (oldWeight > 1) {
            newWeight = oldWeight - (1 * weightFactor);
            if (newWeight < 1) newWeight = 1;
            patch = {down: false, weight: newWeight};
            ngx.log(ngx.WARN, ' - DECREMENTING WEIGHT' + JSON.stringify(patch));
        } else {
            patch = {down: false, weight: 1};
            ngx.log(ngx.WARN, ' - ALREADY AT MIN WEIGHT');
        }
    } else { //if (oldWeight < 10) {
        // Recovering - increase the weight of this server
        newWeight = pw + 1;
        ngx.log(ngx.WARN, ' - INCREASING WEIGHT TO ' + newWeight);
        patch = {down: false, weight: newWeight};
    }

    ngx.fetch('http://127.0.0.1:8888/api/9/http/upstreams/triton_inference/servers/' + serverid, {body: JSON.stringify(patch), method: "PATCH"})
    .then(reply => {
        if (reply.status != 200) {
            ngx.log(ngx.WARN, "WEIGHT ADJUST FAILED: " + reply.status);
        }
    });
}
