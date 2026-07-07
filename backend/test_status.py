import json
from cisco_integration import get_switch_connection

def test_interfaces_status():
    ip = "172.17.32.221"
    user = "netadmin"
    password = "Jupiter12"
    
    print(f"Connecting to {ip}...")
    try:
        net_connect = get_switch_connection(ip, user, password)
        print("Connected successfully!")
        
        print("\nFetching interfaces status...")
        # Use textfsm=True if ntc_templates is correctly configured, otherwise fallback to custom parsing.
        output = net_connect.send_command("show interfaces status", use_textfsm=True)
        print(json.dumps(output, indent=2))
        
        net_connect.disconnect()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    test_interfaces_status()
