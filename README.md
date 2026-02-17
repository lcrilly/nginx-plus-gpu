# GPU-aware load balancing with NGINX Plus

## How it works
NGINX Plus continuously polls NVidia Triton inference server metrics and
adjusts load balancing weights in realtime using the NGINX Plus API.

## You will need
NGINX Plus Docker image tagged `nginx-plus:latest`.

## Preparation
Copy your NGINX One license.jwt file into the **docker-entrypoint.d** directory.

## Start the container
```
docker run -d --name gpu_lb -p 8888:8888 -p 8999:8999 \
       -v $PWD/docker-entrypoint.d:/docker-entrypoint.d \
       -v $PWD/conf.d:/etc/nginx/conf.d \
       nginx-plus:latest
```

## Demo process
1. Test the backend chatbot/inference endpoint and observe the `backend` response header.
```
curl -i http://localhost:8999/
```

2. Query the Prometheus endpoint for the inference servers
```
curl -i http://localhost:8999/metrics
curl -s http://localhost:8999/metrics | grep nv_inference_queue_duration_us
```

3. Send some traffic to the chatbot/inference endpoint
```
ab -q -n 2000 -c 24 http://127.0.0.1:8999/
```

4. Open the [NGINX Plus dashboard](http://localhost:8888/dashboard.html) to the upstream tab
   and watch the backend server weights/status change 
