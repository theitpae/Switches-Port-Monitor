from cisco_integration import get_switch_connection, fetch_port_status, fetch_vlans
import json

def test_connection():
    ip = "172.17.32.221"
    user = "netadmin"
    password = "Jupiter12"
    
    print(f"Connecting to {ip}...")
    try:
        net_connect = get_switch_connection(ip, user, password)
        print("Connected successfully!")
        
        print("\nFetching ports...")
        ports = fetch_port_status(net_connect)
        print(json.dumps(ports, indent=2))
        
        print("\nFetching VLANs...")
        vlans = fetch_vlans(net_connect)
        print(json.dumps(vlans, indent=2))
        
        net_connect.disconnect()
    except Exception as e:
        print(f"Error connecting: {str(e)}")

if __name__ == "__main__":
    test_connection()
