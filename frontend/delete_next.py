import shutil, os
import time

target = "C:\\Users\\296758\\.gemini\\antigravity\\scratch\\cisco-monitor\\frontend\\.next"

for _ in range(5):
    try:
        if os.path.exists(target):
            shutil.rmtree(target)
            print("Successfully deleted .next directory!")
        else:
            print(".next directory does not exist.")
        break
    except Exception as e:
        print(f"Failed to delete, retrying... {e}")
        time.sleep(1)
