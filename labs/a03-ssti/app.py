from flask import Flask, request, render_template, render_template_string, jsonify
import os
import re
import time

app = Flask(__name__, static_folder='static', static_url_path='/static')

security_mode = 'vulnerable'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/settings/security-mode', methods=['GET', 'POST'])
def handle_security_mode():
    global security_mode
    if request.method == 'POST':
        data = request.get_json() or {}
        mode = data.get('mode', '')
        if mode in ['secure', 'vulnerable']:
            security_mode = mode
            return jsonify({"success": True, "securityMode": security_mode})
        return jsonify({"error": "Invalid mode"}), 400
    return jsonify({"securityMode": security_mode})

# Stage 1: Basic Jinja2 SSTI
@app.route('/api/render', methods=['POST'])
def render_template_route():
    global security_mode
    data = request.get_json() or {}
    user_template = data.get('template', '')
    
    if not user_template:
        return jsonify({"error": "Template content cannot be empty."}), 400

    if security_mode == 'secure':
        # SECURE: Escape template brackets to prevent SSTI
        user_template = user_template.replace('{{', '{<span>{</span>').replace('}}', '}<span>}</span>')
        return jsonify({"success": True, "output": user_template})

    try:
        rendered = render_template_string(user_template, name="Guest Operator", system_ver="SecureOS v4.12")
        return jsonify({"success": True, "output": rendered})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 200

# Stage 2: Restricted Keywords (os, popen, subclasses, system blocked)
@app.route('/api/stage2/render', methods=['POST'])
def stage2_render():
    global security_mode
    data = request.get_json() or {}
    user_template = data.get('template', '')
    
    if security_mode == 'secure':
        user_template = user_template.replace('{{', '{<span>{</span>').replace('}}', '}<span>}</span>')
        return jsonify({"success": True, "output": user_template})

    # WAF: Block keywords
    blocked = ['os', 'popen', 'subclasses', 'system', 'subprocess']
    for word in blocked:
        if word in user_template.lower():
            return jsonify({"success": False, "error": f"WAF BLOCK: Restricted keyword '{word}' detected."}), 200

    try:
        rendered = render_template_string(user_template, name="Guest Operator", system_ver="SecureOS v4.12")
        return jsonify({"success": True, "output": rendered})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 200

# Stage 3: Blind SSTI (No output returned)
@app.route('/api/stage3/render', methods=['POST'])
def stage3_render():
    global security_mode
    data = request.get_json() or {}
    user_template = data.get('template', '')
    
    if security_mode == 'secure':
        return jsonify({"success": True, "message": "Render completed successfully in background."})

    try:
        # If they use time.sleep or heavy delay exfiltration
        # Jinja2 rendering is executed
        rendered = render_template_string(user_template, name="Guest Operator", system_ver="SecureOS v4.12")
        
        # Check if sleep was executed or manual check
        if "time" in user_template.lower() and "sleep" in user_template.lower():
            # Ensure time execution occurred
            pass

        return jsonify({"success": True, "message": "Render completed successfully in background."})
    except Exception as e:
        return jsonify({"success": False, "error": "Internal Processing Error"}), 200

# Stage 4: Strict Symbol Filter (Quotes and square brackets blocked)
@app.route('/api/stage4/render', methods=['POST'])
def stage4_render():
    global security_mode
    data = request.get_json() or {}
    user_template = data.get('template', '')
    
    if security_mode == 'secure':
        user_template = user_template.replace('{{', '{<span>{</span>').replace('}}', '}<span>}</span>')
        return jsonify({"success": True, "output": user_template})

    # WAF: Block quotes ' " and square brackets [ ]
    if "'" in user_template or '"' in user_template or '[' in user_template or ']' in user_template:
        return jsonify({"success": False, "error": "WAF BLOCK: Single/Double quotes and square brackets are prohibited."}), 200

    try:
        # Request context parameters can be referenced via request.args
        rendered = render_template_string(user_template, name="Guest Operator", system_ver="SecureOS v4.12")
        return jsonify({"success": True, "output": rendered})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)
