import urllib.request
import json
import traceback

try:
    with urllib.request.urlopen('http://127.0.0.1:8000/api/switches', timeout=5) as response:
        data = json.loads(response.read().decode())
        with open("C:/Users/296758/.gemini/antigravity/scratch/cisco-monitor/backend/api_response2.txt", "w") as f:
            f.write(json.dumps(data, indent=2))
except Exception as e:
    with open("C:/Users/296758/.gemini/antigravity/scratch/cisco-monitor/backend/api_response2.txt", "w") as f:
        f.write(f"Error: {e}\n{traceback.format_exc()}")
