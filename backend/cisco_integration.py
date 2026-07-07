from netmiko import ConnectHandler
import re

def get_switch_connection(ip_address, username, password, secret=""):
    cisco_device = {
        'device_type': 'cisco_ios',
        'host': ip_address,
        'username': username,
        'password': password,
        'secret': secret,
        'port': 22,
    }
    net_connect = ConnectHandler(**cisco_device)
    net_connect.enable()
    return net_connect

import os

# Ensure TextFSM templates are found
template_path = os.path.join(os.path.dirname(__file__), "venv", "Lib", "site-packages", "ntc_templates", "templates")
if os.path.exists(template_path):
    os.environ["NET_TEXTFSM"] = template_path

def fetch_port_status(net_connect):
    try:
        output = net_connect.send_command("show interfaces status", use_textfsm=True)
        ports = []
        for row in output:
            if isinstance(row, dict):
                ports.append({
                    "interface": row.get("port"),
                    "name": row.get("name", "").strip(),
                    "status": row.get("status", ""),        # keep original: connected / notconnect / disabled / err-disabled
                    "vlan": row.get("vlan_id") or row.get("vlan", ""),
                    "duplex": row.get("duplex", ""),
                    "speed": row.get("speed", ""),
                    "type": row.get("type", "") or row.get("media_type", ""),
                })
        return ports
    except Exception as e:
        print(f"Error parsing show interfaces status: {e}")
        return []

def fetch_vlans(net_connect):
    output = net_connect.send_command("show vlan brief")
    vlans = []
    # Parsing 'show vlan brief'
    for line in output.splitlines():
        if re.match(r'^\d+', line):
            parts = line.split()
            vlan_id = parts[0]
            name = parts[1]
            status = parts[2]
            vlans.append({
                "vlan_id": vlan_id,
                "name": name,
                "status": status
            })
    return vlans

def add_vlan(net_connect, vlan_id, name):
    config_commands = [
        f"vlan {vlan_id}",
        f"name {name}"
    ]
    output = net_connect.send_config_set(config_commands)
    return output

def assign_port_to_vlan(net_connect, interface, vlan_id):
    if str(vlan_id).lower() == "trunk":
        config_commands = [
            f"interface {interface}",
            "switchport mode trunk",
        ]
    else:
        config_commands = [
            f"interface {interface}",
            "switchport mode access",
            f"switchport access vlan {vlan_id}"
        ]
    output = net_connect.send_config_set(config_commands)
    return output

def set_port_description(net_connect, interface, description):
    config_commands = [
        f"interface {interface}",
        f"description {description}" if description else "no description"
    ]
    output = net_connect.send_config_set(config_commands)
    return output

def shutdown_port(net_connect, interface):
    config_commands = [
        f"interface {interface}",
        "shutdown"
    ]
    output = net_connect.send_config_set(config_commands)
    return output

def enable_port(net_connect, interface):
    config_commands = [
        f"interface {interface}",
        "no shutdown"
    ]
    output = net_connect.send_config_set(config_commands)
    return output

def save_running_config(net_connect):
    output = net_connect.send_command("write memory")
    return output
