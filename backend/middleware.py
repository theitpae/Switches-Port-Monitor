from fastapi import Request
from fastapi.responses import JSONResponse

# Simulated DB fetch for allowed IPs
ALLOWED_VPN_IPS = ["110.170.81.240", "119.63.94.110", "127.0.0.1"]

async def vpn_ip_check_middleware(request: Request, call_next):
    if request.url.path in ["/health", "/docs", "/openapi.json"]:
        return await call_next(request)
        
    client_ip = request.client.host
    if client_ip not in ALLOWED_VPN_IPS:
        return JSONResponse(
            status_code=403,
            content={"detail": f"Access denied. IP {client_ip} is not in the VPN whitelist."}
        )
    response = await call_next(request)
    return response
