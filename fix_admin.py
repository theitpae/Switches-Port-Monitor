
filepath = r"C:\Users\296758\.gemini\antigravity\scratch\cisco-monitor\frontend\app\admin\page.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Try both line endings
for crlf in [True, False]:
    nl = '\r\n' if crlf else '\n'
    old = (
        f"        </table>{nl}"
        f"      </div>{nl}"
        f"    </>{nl}"
        f"  );{nl}"
        f"}}{nl}"
        f"{nl}"
        f"// \u2500\u2500\u2500 Sessions Tab"
    )
    if old in content:
        new = (
            f"        </table>{nl}"
            f"        {{filteredUsers.length === 0 && ({nl}"
            f"          <div style={{{{ textAlign: 'center', padding: '40px', color: '#475569' }}}}>{nl}"
            f"            {{search ? `\U0001f50d \u0e44\u0e21\u0e48\u0e1e\u0e1a User \u0e17\u0e35\u0e48\u0e15\u0e23\u0e07\u0e01\u0e31\u0e1a \"${{search}}\"` : '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35 User'}}{nl}"
            f"          </div>{nl}"
            f"        )}}{nl}"
            f"      </div>{nl}"
            f"    </>{nl}"
            f"  );{nl}"
            f"}}{nl}"
            f"{nl}"
            f"// \u2500\u2500\u2500 Sessions Tab"
        )
        content = content.replace(old, new, 1)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"OK: replaced ({'CRLF' if crlf else 'LF'})")
        break
else:
    print("ERROR: pattern not found")
