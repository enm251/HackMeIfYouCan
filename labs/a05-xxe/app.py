import os
from flask import Flask, request, render_template, jsonify
from lxml import etree
import sys
import re

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

# Stage 1: Basic XXE
@app.route('/api/parse', methods=['POST'])
def parse_xml():
    global security_mode
    xml_data = request.data
    if not xml_data:
        return jsonify({"error": "No XML payload received."}), 400

    try:
        if security_mode == 'secure':
            parser = etree.XMLParser(resolve_entities=False, no_network=True)
        else:
            parser = etree.XMLParser(resolve_entities=True, no_network=False)

        root = etree.fromstring(xml_data, parser=parser)
        
        name = root.findtext('name') or 'Anonymous User'
        email = root.findtext('email') or 'no-email@corporate.local'
        message = root.findtext('message') or ''
        
        response_msg = f"Thank you {name} ({email}) for your inquiry. Our support team will review your message: '{message}'."
        return jsonify({"success": True, "output": response_msg})
        
    except Exception as e:
        return jsonify({"success": False, "error": f"XML Parse Error: {str(e)}"}), 400

# Stage 2: Protocol Block Bypass (file:// protocol is blacklisted)
@app.route('/api/stage2/parse', methods=['POST'])
def stage2_parse():
    global security_mode
    xml_data = request.data
    if not xml_data:
        return jsonify({"error": "No XML"}), 400

    if security_mode == 'secure':
        return jsonify({"success": True, "output": "Secure XML parsed."})

    # WAF: Block 'file://' literal
    if b"file://" in xml_data.lower():
        return jsonify({"success": False, "error": "WAF BLOCK: The 'file://' protocol is prohibited in entity system references."}), 400

    try:
        parser = etree.XMLParser(resolve_entities=True, no_network=False)
        root = etree.fromstring(xml_data, parser=parser)
        
        name = root.findtext('name') or 'Anonymous User'
        email = root.findtext('email') or ''
        message = root.findtext('message') or ''
        
        response_msg = f"Corporate Dispatcher resolved contact metadata: {name} | {email} | {message}"
        return jsonify({"success": True, "output": response_msg})
    except Exception as e:
        return jsonify({"success": False, "error": f"XML Parse Error: {str(e)}"}), 400

# Stage 3: Blind XXE (No output returned)
@app.route('/api/stage3/parse', methods=['POST'])
def stage3_parse():
    global security_mode
    xml_data = request.data
    if not xml_data:
        return jsonify({"error": "No XML"}), 400

    if security_mode == 'secure':
        return jsonify({"success": True, "output": "Blind XML parsed safely."})

    try:
        parser = etree.XMLParser(resolve_entities=True, no_network=False)
        root = etree.fromstring(xml_data, parser=parser)
        
        # Check for OOB Exfiltration trigger
        # If payload contains an external HTTP entity matching our mock OOB server
        oob_triggered = False
        oob_data = ""
        
        # Parse XML string to find if OOB endpoint is called
        # Simulating Out-of-band receiver logs
        if b"oob-receiver.local" in xml_data:
            oob_triggered = True
            match = re.search(r'oob-receiver\.local/([a-zA-Z0-9_\-\{\}]+)', xml_data.decode('utf-8', errors='ignore'))
            if match:
                oob_data = match.group(1)

        # Do NOT return parsed fields to client
        return jsonify({
            "success": True, 
            "output": "Inquiry successfully recorded in secure processing queue.",
            "oob_triggered": oob_triggered,
            "oob_data": oob_data
        })
    except Exception as e:
        return jsonify({"success": False, "error": "Parser executed silently with status code 200."}), 400

# Stage 4: SVG Image Parser XXE
@app.route('/api/stage4/parse', methods=['POST'])
def stage4_parse():
    global security_mode
    xml_data = request.data
    if not xml_data:
        return jsonify({"error": "No SVG data received."}), 400

    try:
        if security_mode == 'secure':
            parser = etree.XMLParser(resolve_entities=False, no_network=True)
        else:
            parser = etree.XMLParser(resolve_entities=True, no_network=False)

        root = etree.fromstring(xml_data, parser=parser)
        
        # Retrieve title text from SVG XML namespace
        # Standard SVG has a <title> element
        title = root.findtext('{http://www.w3.org/2000/svg}title') or root.findtext('title') or 'Default SVG title'
        
        response_msg = f"SVG Asset Compiled Successfully. Extracted Asset Title: '{title}'"
        return jsonify({"success": True, "output": response_msg})
        
    except Exception as e:
        return jsonify({"success": False, "error": f"SVG Vector Parse Error: {str(e)}"}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 3000)), debug=True)
