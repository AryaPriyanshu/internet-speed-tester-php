# Free deployment guide

## Recommended option: Render

The included `render.yaml` and `Dockerfile` prepare Pulse for Render's free web-service tier in the Singapore region. This is suitable for a private demo and functional remote tests without requiring a card.

### Deploy

1. Create a new GitHub repository and upload the contents of this project directory.
2. In Render, choose **New → Blueprint** and connect that repository.
3. Confirm the `pulse-speed-test` service, **Free** plan, and **Singapore** region.
4. Apply the Blueprint and wait for the health check to pass.
5. Open the generated `onrender.com` address. If the service was asleep, let the first page finish loading before running the first test.

The health check is available at `/api/health.php`. A healthy response contains `"status":"ok"`.

### Important free-tier limits

- A free Render web service spins down after 15 minutes without inbound traffic. Its next request can take about a minute while it starts again.
- Render's current Hobby workspace allowance includes 5 GB of outbound bandwidth per month. The download phase consumes outbound bandwidth quickly: a connection sustaining 100 Mbps for six seconds transfers roughly 75 MB before calibration and protocol overhead.
- Without a payment method, Render suspends services that exceed included bandwidth instead of silently converting this Blueprint to a paid service.
- A shared free service is useful for demonstrating the app, but its cold starts, shared CPU, network limits, and monthly allowance prevent it from being an ISP-grade speed-test target.

Current terms should be rechecked before deployment:

- https://render.com/docs/free
- https://render.com/docs/outbound-bandwidth
- https://render.com/docs/docker

## Alternative: Koyeb

Koyeb currently advertises a free instance and a larger outbound allowance, but it requires a payment card and may place a temporary verification hold. Its free instance also has only 0.1 vCPU and is not available in an Asian region. For this project, Render is the safer no-card demonstration option.

## When accuracy matters

Use a paid server with a guaranteed network port, enough monthly transfer, and a region near the people testing. Keep `PULSE_TRUST_PROXY=1` only when the hosting proxy replaces client-supplied forwarding headers. Pulse history needs no server database because it remains in each browser's local storage.
