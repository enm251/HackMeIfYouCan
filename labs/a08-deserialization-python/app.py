from flask import Flask, request, render_template, make_response, jsonify
import pickle
import base64
import os
import io
import json
import types
import re
import time
from datetime import datetime

app = Flask(__name__, static_folder='static')

# ---------------------------------------------------------------------------
# Security mode: 'vulnerable' (default) or 'secure'
# ---------------------------------------------------------------------------
security_mode = 'vulnerable'

# ---------------------------------------------------------------------------
# Flags per stage
# ---------------------------------------------------------------------------
STAGE_FLAGS = {
    1: 'FLAG{pickle_deserialization_rce}',
    2: 'FLAG{pickle_import_filter_bypass}',
    3: 'FLAG{pickle_restricted_unpickler_escape}',
    4: 'FLAG{pickle_sandbox_code_object_rce}',
}

# Flag files per stage (stage 1 uses flag.txt on disk, others are in-memory)
STAGE_FLAG_FILES = {
    2: '/tmp/stage2_flag.txt',
    3: '/tmp/stage3_flag.txt',
    4: '/tmp/stage4_flag.txt',
}

# ---------------------------------------------------------------------------
# HTTP Transaction Logger (in-memory, max 50)
# ---------------------------------------------------------------------------
logs = []
MAX_LOGS = 50


def add_log(entry):
    global logs
    logs.append(entry)
    if len(logs) > MAX_LOGS:
        logs = logs[-MAX_LOGS:]


# ---------------------------------------------------------------------------
# Default session helper
# ---------------------------------------------------------------------------
class SessionData:
    def __init__(self, username, role):
        self.username = username
        self.role = role


def make_default_cookie():
    default_session = SessionData('guest', 'guest')
    pickled = pickle.dumps(default_session)
    return base64.b64encode(pickled).decode('utf-8')


# ---------------------------------------------------------------------------
# Stage 2: Filtered unpickler -- blocks 'os' and 'subprocess' modules
# ---------------------------------------------------------------------------
class Stage2FilteredUnpickler(pickle.Unpickler):
    BLOCKED_MODULES = {'os', 'subprocess', 'posix', 'nt'}

    def find_class(self, module, name):
        if module in self.BLOCKED_MODULES:
            raise pickle.UnpicklingError(
                'Import of module [%s] is blocked by security filter' % module
            )
        return super().find_class(module, name)


def stage2_loads(data):
    return Stage2FilteredUnpickler(io.BytesIO(data)).load()


# ---------------------------------------------------------------------------
# Stage 3: Restricted unpickler -- blocks __reduce__ by intercepting REDUCE opcode
# Also blocks os/subprocess. Only allows __setstate__ bypass path.
# ---------------------------------------------------------------------------
class Stage3RestrictedUnpickler(pickle.Unpickler):
    BLOCKED_MODULES = {'os', 'subprocess', 'posix', 'nt'}
    BLOCKED_NAMES = {'system', 'popen', 'exec', 'eval', 'execfile', 'compile'}

    def find_class(self, module, name):
        if module in self.BLOCKED_MODULES:
            raise pickle.UnpicklingError(
                'Import of module [%s] is blocked by restricted unpickler' % module
            )
        if name == '__reduce__' or name == '__reduce_ex__':
            raise pickle.UnpicklingError(
                '__reduce__ is blocked by restricted unpickler'
            )
        return super().find_class(module, name)


def stage3_loads(data):
    return Stage3RestrictedUnpickler(io.BytesIO(data)).load()


# ---------------------------------------------------------------------------
# Stage 4: Sandboxed unpickler -- whitelist-only classes
# Only allows specific safe classes. Bypass requires chaining
# types.CodeType + types.FunctionType to construct arbitrary code objects.
# ---------------------------------------------------------------------------
class Stage4SandboxedUnpickler(pickle.Unpickler):
    ALLOWED_CLASSES = {
        ('builtins', 'dict'),
        ('builtins', 'list'),
        ('builtins', 'tuple'),
        ('builtins', 'set'),
        ('builtins', 'frozenset'),
        ('builtins', 'str'),
        ('builtins', 'int'),
        ('builtins', 'float'),
        ('builtins', 'bool'),
        ('builtins', 'bytes'),
        ('builtins', 'type'),
        ('builtins', 'getattr'),
        ('builtins', 'apply'),  # Python 2 compat name, not actually usable
        ('collections', 'OrderedDict'),
        ('types', 'CodeType'),
        ('types', 'FunctionType'),
    }

    def find_class(self, module, name):
        if (module, name) not in self.ALLOWED_CLASSES:
            raise pickle.UnpicklingError(
                'Class [%s.%s] is not in the sandbox whitelist' % (module, name)
            )
        return super().find_class(module, name)


def stage4_loads(data):
    return Stage4SandboxedUnpickler(io.BytesIO(data)).load()


# ---------------------------------------------------------------------------
# Logging middleware
# ---------------------------------------------------------------------------
@app.before_request
def log_request():
    path = request.path
    if path.startswith('/api/settings') or path.startswith('/api/logs'):
        return
    if path.startswith('/static'):
        return

    entry = {
        'timestamp': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.') +
                     '%03d' % (datetime.utcnow().microsecond // 1000) + 'Z',
        'method': request.method,
        'url': request.url,
        'headers': dict(request.headers),
        'body': request.get_data(as_text=True) or None,
        'response_status': None,
        'response_body': None,
    }
    request._log_entry = entry


@app.after_request
def log_response(response):
    entry = getattr(request, '_log_entry', None)
    if entry is not None:
        entry['response_status'] = response.status_code
        try:
            entry['response_body'] = response.get_data(as_text=True)[:500]
        except Exception:
            entry['response_body'] = '[binary data]'
        add_log(entry)
    return response


# ---------------------------------------------------------------------------
# API: Security Mode
# ---------------------------------------------------------------------------
@app.route('/api/settings/security-mode', methods=['GET'])
def get_security_mode():
    return jsonify({'securityMode': security_mode})


@app.route('/api/settings/security-mode', methods=['POST'])
def set_security_mode():
    global security_mode
    data = request.get_json(force=True, silent=True) or {}
    mode = data.get('mode', '')
    if mode in ('secure', 'vulnerable'):
        security_mode = mode
        return jsonify({'securityMode': security_mode, 'success': True})
    return jsonify({'error': 'Invalid mode. Use "secure" or "vulnerable".'}), 400


# ---------------------------------------------------------------------------
# API: Logs
# ---------------------------------------------------------------------------
@app.route('/api/logs', methods=['GET'])
def get_logs():
    return jsonify({'logs': logs})


@app.route('/api/logs/clear', methods=['POST'])
def clear_logs():
    global logs
    logs = []
    return jsonify({'success': True})


# ---------------------------------------------------------------------------
# API: Stage info endpoint
# ---------------------------------------------------------------------------
@app.route('/api/stages', methods=['GET'])
def get_stages():
    stage_info = {
        1: {
            'id': 1,
            'title': 'Stage 1: Standard pickle.loads() RCE',
            'difficulty': 'Easy',
            'description': (
                'The server deserializes the session cookie using pickle.loads() '
                'with zero validation. Craft a pickle payload using the __reduce__ '
                'method to execute os.system() and copy flag.txt to static/flag.txt. '
                'Then fetch /static/flag.txt to retrieve the flag.'
            ),
            'flag_location': '/static/flag.txt (after RCE copy)',
            'hint': 'Use pickle opcode: cos\\nsystem\\n(S\'cp flag.txt static/flag.txt\'\\ntR.',
        },
        2: {
            'id': 2,
            'title': 'Stage 2: Import Filter Bypass',
            'difficulty': 'Medium',
            'description': (
                'The server uses a custom Unpickler that blocks os, subprocess, posix, '
                'and nt module imports. Bypass the filter using alternative import paths '
                'such as builtins.__import__(), eval(), or exec() gadgets. '
                'Copy /tmp/stage2_flag.txt to static/stage2_flag.txt then fetch it.'
            ),
            'flag_location': '/static/stage2_flag.txt (after RCE copy)',
            'hint': 'Try builtins.eval or builtins.exec to dynamically import blocked modules.',
        },
        3: {
            'id': 3,
            'title': 'Stage 3: Restricted Unpickler Escape',
            'difficulty': 'Hard',
            'description': (
                'The server blocks os/subprocess imports AND intercepts __reduce__/__reduce_ex__ '
                'lookups in find_class. Standard REDUCE-based gadgets will fail. '
                'Bypass using __setstate__, BUILD opcode, or class instantiation gadgets. '
                'Copy /tmp/stage3_flag.txt to static/stage3_flag.txt then fetch it.'
            ),
            'flag_location': '/static/stage3_flag.txt (after RCE copy)',
            'hint': 'Construct an object and use BUILD opcode to trigger __setstate__ with a callable.',
        },
        4: {
            'id': 4,
            'title': 'Stage 4: Sandbox Code Object RCE',
            'difficulty': 'Expert',
            'description': (
                'The server uses a whitelist-only unpickler. Only basic types plus '
                'types.CodeType and types.FunctionType are allowed. '
                'Chain CodeType + FunctionType to construct an arbitrary function object '
                'and execute it. Write the flag to static/stage4_flag.txt then fetch it.'
            ),
            'flag_location': '/static/stage4_flag.txt (after RCE copy)',
            'hint': 'Build a code object with types.CodeType(...), wrap it in types.FunctionType(...), invoke it.',
        },
    }
    return jsonify({'stages': stage_info})


# ---------------------------------------------------------------------------
# Main route: handles all stages via ?stage=N query parameter
# ---------------------------------------------------------------------------
@app.route('/', methods=['GET'])
def index():
    stage = request.args.get('stage', None)

    # If no stage param, serve the dashboard HTML (or process stage 1 if cookie present)
    # verify_labs.js sends GET / with session cookie and no ?stage param
    # so we must always process the cookie on GET / for backward compat
    session_cookie = request.cookies.get('session')
    user_status = 'Guest Session'
    role_status = 'guest'
    stage_result = None
    active_stage = int(stage) if stage and stage.isdigit() and 1 <= int(stage) <= 4 else 1

    if session_cookie:
        try:
            decoded_cookie = base64.b64decode(session_cookie)

            if security_mode == 'secure':
                # Secure mode: reject pickle, try JSON parse only
                try:
                    session_obj_dict = json.loads(decoded_cookie.decode('utf-8'))
                    user_status = session_obj_dict.get('username', 'unknown')
                    role_status = session_obj_dict.get('role', 'guest')
                    stage_result = {
                        'status': 'blocked',
                        'message': 'Remediation Shield ACTIVE: Pickle deserialization disabled. Using safe JSON parsing.',
                    }
                except Exception:
                    stage_result = {
                        'status': 'blocked',
                        'message': 'Remediation Shield ACTIVE: Cookie rejected (not valid JSON).',
                    }
            else:
                # Vulnerable mode: process per stage
                if active_stage == 1:
                    # Stage 1: raw pickle.loads (original behavior)
                    session_obj = pickle.loads(decoded_cookie)
                    user_status = getattr(session_obj, 'username', 'unknown')
                    role_status = getattr(session_obj, 'role', 'guest')

                elif active_stage == 2:
                    # Stage 2: filtered unpickler
                    session_obj = stage2_loads(decoded_cookie)
                    user_status = getattr(session_obj, 'username', 'unknown')
                    role_status = getattr(session_obj, 'role', 'guest')

                elif active_stage == 3:
                    # Stage 3: restricted unpickler
                    session_obj = stage3_loads(decoded_cookie)
                    user_status = getattr(session_obj, 'username', 'unknown')
                    role_status = getattr(session_obj, 'role', 'guest')

                elif active_stage == 4:
                    # Stage 4: sandboxed unpickler
                    session_obj = stage4_loads(decoded_cookie)
                    user_status = getattr(session_obj, 'username', 'unknown')
                    role_status = getattr(session_obj, 'role', 'guest')

        except Exception as e:
            user_status = 'Session Error'
            role_status = 'error'
            stage_result = {
                'status': 'error',
                'message': str(e),
            }

    resp = make_response(render_template('index.html', user=user_status, role=role_status))

    if not session_cookie:
        encoded = make_default_cookie()
        resp.set_cookie('session', encoded, path='/')

    return resp


# ---------------------------------------------------------------------------
# Verify flag endpoints (for frontend flag checking)
# ---------------------------------------------------------------------------
@app.route('/api/verify-flag', methods=['POST'])
def verify_flag():
    data = request.get_json(force=True, silent=True) or {}
    stage = data.get('stage', 1)
    submitted = data.get('flag', '').strip()
    expected = STAGE_FLAGS.get(stage, '')
    if submitted == expected:
        return jsonify({'success': True, 'message': 'Flag verified for stage %d' % stage})
    return jsonify({'success': False, 'message': 'Incorrect flag for stage %d' % stage})


# ---------------------------------------------------------------------------
# Init: create directories, write flag files
# ---------------------------------------------------------------------------
def init_app():
    os.makedirs('static', exist_ok=True)

    # Stage 1 flag lives in flag.txt (root dir) -- do not overwrite
    # Stages 2-4 have separate flag files
    for stage_num, path in STAGE_FLAG_FILES.items():
        flag_dir = os.path.dirname(path)
        if flag_dir:
            os.makedirs(flag_dir, exist_ok=True)
        with open(path, 'w') as f:
            f.write(STAGE_FLAGS[stage_num] + '\n')


if __name__ == '__main__':
    init_app()
    app.run(host='0.0.0.0', port=3000, debug=True)
