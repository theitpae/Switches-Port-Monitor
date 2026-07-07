import urllib.request
import json
try:
    with urllib.request.urlopen('http://localhost:8000/api/switches') as response:
        print(json.loads(response.read().decode()))
except Exception as e:
    print("Error:", e)
