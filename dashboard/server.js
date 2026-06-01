const express = require('express');
const path = require('path');
const Docker = require('dockerode');
const WebSocket = require('ws');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Dockerode. Fallback to null if socket is inaccessible.
let docker = null;
try {
  docker = new Docker({ socketPath: '/var/run/docker.sock' });
} catch (err) {
  console.warn("WARNING: Could not connect to Docker socket. Running in Mock/Offline mode.");
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: check container running status
async function getContainerStatus(containerName) {
  if (!docker) return false;
  try {
    const container = docker.getContainer(containerName);
    const inspectData = await container.inspect();
    return inspectData.State.Running;
  } catch (err) {
    // Container might not be created or running
    return false;
  }
}

// API: Get all labs
app.get('/api/labs', async (req, res) => {
  try {
    const labs = db.getLabs();
    // Dynamically query docker for current running status of each container
    const updatedLabs = await Promise.all(labs.map(async (lab) => {
      let isRunning = false;
      if (docker) {
        isRunning = await getContainerStatus(lab.containerName);
      } else {
        // Single-container / Render mode: all labs are managed by PM2 and always running
        isRunning = true;
      }
      // Keep db file state in sync
      if (lab.active !== isRunning) {
        db.updateLab(lab.id, { active: isRunning });
        lab.active = isRunning;
      }
      return lab;
    }));
    
    res.json({
      success: true,
      user: db.getLabs().filter(l => l.solved).length, // simple stats
      labs: updatedLabs
    });
  } catch (error) {
    console.error("API error getting labs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Start lab
app.post('/api/labs/:id/start', async (req, res) => {
  const { id } = req.params;
  const lab = db.getLab(id);
  
  if (!lab) {
    return res.status(404).json({ success: false, error: "Lab not found" });
  }

  if (!docker) {
    // Mock mode
    db.updateLab(id, { active: true });
    return res.json({ success: true, message: `[MOCK MODE] Started lab ${id}`, lab: db.getLab(id) });
  }

  try {
    const container = docker.getContainer(lab.containerName);
    const inspectData = await container.inspect();
    
    if (!inspectData.State.Running) {
      await container.start();
      console.log(`Successfully started container: ${lab.containerName}`);
    }
    
    db.updateLab(id, { active: true });
    res.json({ success: true, message: "Lab container started successfully", lab: db.getLab(id) });
  } catch (error) {
    console.error(`Error starting container ${lab.containerName}:`, error);
    res.status(500).json({ 
      success: false, 
      error: `Could not start container. Make sure 'docker compose up -d' has initialized all containers. System message: ${error.message}` 
    });
  }
});

// API: Stop lab
app.post('/api/labs/:id/stop', async (req, res) => {
  const { id } = req.params;
  const lab = db.getLab(id);
  
  if (!lab) {
    return res.status(404).json({ success: false, error: "Lab not found" });
  }

  if (!docker) {
    // Mock mode
    db.updateLab(id, { active: false });
    return res.json({ success: true, message: `[MOCK MODE] Stopped lab ${id}`, lab: db.getLab(id) });
  }

  try {
    const container = docker.getContainer(lab.containerName);
    const inspectData = await container.inspect();
    
    if (inspectData.State.Running) {
      await container.stop();
      console.log(`Successfully stopped container: ${lab.containerName}`);
    }
    
    db.updateLab(id, { active: false });
    res.json({ success: true, message: "Lab container stopped successfully", lab: db.getLab(id) });
  } catch (error) {
    console.error(`Error stopping container ${lab.containerName}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Map of progressive stage flags for multi-stage labs
const STAGE_FLAGS = {
  "a01-idor": [
    "FLAG{idor_direct_access_success}",
    "FLAG{idor_uuid_leakage_medium}",
    "FLAG{idor_nested_route_bypass_hard}",
    "FLAG{idor_bola_mass_assignment_expert}"
  ],
  "a01-privesc": [
    "FLAG{jwt_privilege_escalation_admin}",
    "FLAG{jwt_none_algorithm_bypass_medium}",
    "FLAG{jwt_weak_hmac_secret_cracked_hard}",
    "FLAG{jwt_jwk_parameter_injection_expert}"
  ],
  "a01-path-traversal": [
    "FLAG{local_file_inclusion_secret}",
    "FLAG{path_traversal_stripped_sequences_medium}",
    "FLAG{path_traversal_null_byte_bypass_hard}",
    "FLAG{path_traversal_directory_lock_bypass_expert}"
  ],
  "a02-weak-crypto": [
    "FLAG{broken_cryptography_cracked}",
    "FLAG{weak_md5_hash_cracked_medium}",
    "FLAG{xor_keystream_leakage_hard}",
    "FLAG{rsa_private_key_leakage_expert}"
  ],
  "a03-nosql": [
    "FLAG{nosql_operator_injection_bypass}",
    "FLAG{nosql_escaped_operator_bypass}",
    "FLAG{nosql_blind_timing_extraction}",
    "FLAG{nosql_nested_regex_extraction_expert}"
  ],
  "a03-xpath": [
    "FLAG{xpath_xml_traversal_success}",
    "FLAG{xpath_waf_boolean_bypass}",
    "FLAG{xpath_blind_brute_force}",
    "FLAG{xpath_xxe_chain_expert}"
  ],
  "a06-request-smuggling": [
    "FLAG{request_smuggling_cl_te_poisoning}",
    "FLAG{request_smuggling_te_cl_bypass}",
    "FLAG{request_smuggling_cl_cl_header}",
    "FLAG{request_smuggling_cache_poison_expert}"
  ],
  "a07-brute-force": [
    "FLAG{verbose_errors_enable_brute_force}",
    "FLAG{brute_force_ip_rotation_bypass}",
    "FLAG{brute_force_lockout_bypass}",
    "FLAG{brute_force_timing_enum_expert}"
  ],
  "a08-prototype-pollution": [
    "FLAG{prototype_pollution_global_pollution}",
    "FLAG{prototype_constructor_bypass}",
    "FLAG{prototype_pollution_rce_shell}",
    "FLAG{prototype_renderer_bypass_expert}"
  ],
  "a09-log-xss": [
    "FLAG{log_poisoning_stored_xss}",
    "FLAG{log_xss_ip_header_bypass}",
    "FLAG{log_xss_csp_exfiltration_bypass}",
    "FLAG{log_xss_proto_pollution_render_expert}"
  ],
  "a10-ssrf": [
    "FLAG{ssrf_internal_metadata_leak}",
    "FLAG{ssrf_hex_ip_blacklist_bypass}",
    "FLAG{ssrf_blind_port_scan_timing}",
    "FLAG{ssrf_open_redirect_chain_expert}"
  ],
  "a10-ssrf-bypass": [
    "FLAG{ssrf_blacklist_bypass_secret}",
    "FLAG{ssrf_dns_rebinding_bypass}",
    "FLAG{ssrf_ipv6_bracket_bypass}",
    "FLAG{ssrf_unicode_idn_normalization_expert}"
  ],
  "a01-cors": [
    "FLAG{cors_origin_credential_leak}",
    "FLAG{cors_regex_suffix_bypass}",
    "FLAG{cors_null_origin_bypass}",
    "FLAG{cors_xss_chain_exfiltration_expert}"
  ],
  "a03-sqli-time": [
    "FLAG{time_sqli_exfiltrated}",
    "FLAG{sqli_time_waf_keyword_bypass}",
    "FLAG{sqli_time_stacked_query_blind}",
    "FLAG{sqli_time_quote_escape_bypass}"
  ],
  "a03-argument-injection": [
    "FLAG{argument_injection_rce_parameter}",
    "FLAG{argument_prefix_bypass}",
    "FLAG{argument_inband_exfiltration}",
    "FLAG{argument_git_command_execution_expert}"
  ],
  "a03-second-order": [
    "FLAG{second_order_sqli_takeover}",
    "FLAG{second_order_sqli_waf_bypass}",
    "FLAG{second_order_sqli_stacked_delay}",
    "FLAG{second_order_numeric_bypass_expert}"
  ],
  "a04-race-condition": [
    "FLAG{race_condition_concurrency_bypass}",
    "FLAG{race_condition_transfer_double_spend}",
    "FLAG{race_condition_temp_file_overwrite_bypass}",
    "FLAG{race_condition_oauth_code_reuse_expert}"
  ],
  "a07-jwt-bypass": [
    "FLAG{jwt_none_signature_bypass}",
    "FLAG{jwt_mixed_case_none_bypass}",
    "FLAG{jwt_weak_key_brute_force}",
    "FLAG{jwt_dynamic_jwk_injection_rs256}"
  ],
  "a08-deserialization-python": [
    "FLAG{pickle_deserialization_rce}",
    "FLAG{pickle_import_filter_bypass}",
    "FLAG{pickle_restricted_unpickler_escape}",
    "FLAG{pickle_sandbox_code_object_rce}"
  ],
  "a09-log-injection": [
    "FLAG{log_poisoning_rce_shell}",
    "FLAG{log_poisoning_referer_bypass}",
    "FLAG{php_session_file_poisoning}",
    "FLAG{php_filter_chain_rce_expert}"
  ],
  "a03-sqli-union": [
    "FLAG{sqli_union_data_extracted}",
    "FLAG{sqli_union_waf_bypass_successful}",
    "FLAG{sqli_union_hex_encoding_bypass}",
    "FLAG{sqli_union_recursive_bypass_expert}"
  ],
  "a03-sqli-blind": [
    "FLAG{blind_sqli_exfiltrated}",
    "FLAG{blind_sqli_time_exfiltration_success}",
    "FLAG{blind_sqli_error_based_exfiltration}",
    "FLAG{blind_sqli_operator_bypass_expert}"
  ],
  "a03-cmd-injection": [
    "FLAG{command_injection_rce_shell}",
    "FLAG{cmd_injection_newline_delimited_bypass}",
    "FLAG{cmd_injection_blind_exfiltration}",
    "FLAG{cmd_injection_alternative_binary_obfuscation}"
  ],
  "a03-ssti": [
    "FLAG{ssti_template_rce_done}",
    "FLAG{ssti_sandbox_attribute_bypass}",
    "FLAG{ssti_blind_time_exfiltration}",
    "FLAG{ssti_expert_parameter_injection}"
  ],
  "a04-insecure-design": [
    "FLAG{broken_reset_flow_hijacked}",
    "FLAG{weak_prng_brute_force_success}",
    "FLAG{host_header_poisoning_leaked}",
    "FLAG{session_leak_via_referer_header}"
  ],
  "a05-xxe": [
    "FLAG{xxe_external_entity_leak}",
    "FLAG{xxe_protocol_bypass_success}",
    "FLAG{xxe_blind_oob_exfiltration}",
    "FLAG{xxe_svg_upload_exploitation}"
  ],
  "a06-outdated-components": [
    "FLAG{vulnerable_dependency_cve_rce}",
    "FLAG{ejs_output_function_injection}",
    "FLAG{ejs_blind_prototype_pollution}",
    "FLAG{global_prototype_pollution_bypass_expert}"
  ],
  "a05-git": [
    "FLAG{git_repo_secrets_dumped}",
    "FLAG{git_branch_secret_recovery}",
    "FLAG{git_packfile_blob_extraction}",
    "FLAG{git_stash_reflog_recovery_expert}"
  ],
  "a08-node-serialize": [
    "FLAG{node_serialize_rce_shell}",
    "FLAG{node_serialize_waf_bypass}",
    "FLAG{node_serialize_property_pollution}",
    "FLAG{node_serialize_sandbox_expert}"
  ],
  "a03-ldap": [
    "FLAG{ldap_filter_wildcard_leak}",
    "FLAG{ldap_bracket_injection_bypass}",
    "FLAG{ldap_timing_side_channel}",
    "FLAG{ldap_privilege_escalation_expert}"
  ],
  "a07-oauth": [
    "FLAG{oauth_redirect_uri_hijack}",
    "FLAG{oauth_regex_domain_bypass}",
    "FLAG{oauth_state_csrf_bypass}",
    "FLAG{oauth_postmessage_leak_expert}"
  ]
};

// API: Submit Flag
app.post('/api/labs/:id/submit', (req, res) => {
  const { id } = req.params;
  const { flag } = req.body;
  const lab = db.getLab(id);
  
  if (!lab) {
    return res.status(404).json({ success: false, error: "Lab not found" });
  }

  if (!flag) {
    return res.status(400).json({ success: false, error: "Flag is required" });
  }

  const cleanFlag = flag.trim();
  const isPrimaryMatch = cleanFlag === lab.flag;
  const isStageMatch = STAGE_FLAGS[id] && STAGE_FLAGS[id].includes(cleanFlag);

  if (isPrimaryMatch || isStageMatch) {
    db.updateLab(id, { solved: true });
    res.json({ success: true, message: "Correct flag! Challenge solved.", lab: db.getLab(id) });
  } else {
    res.json({ success: false, error: "Incorrect flag. Try again!" });
  }
});

// API: Start all labs
app.post('/api/labs/start-all', async (req, res) => {
  try {
    const labs = db.getLabs();
    if (docker) {
      // Start all lab containers concurrently in the background
      Promise.all(labs.map(async (lab) => {
        try {
          const container = docker.getContainer(lab.containerName);
          const inspectData = await container.inspect();
          if (!inspectData.State.Running) {
            await container.start();
          }
        } catch (e) {}
        db.updateLab(lab.id, { active: true });
      })).catch(err => console.error("Error starting all labs:", err));
    } else {
      for (const lab of labs) {
        db.updateLab(lab.id, { active: true });
      }
    }
    res.json({ success: true, message: "All lab containers are starting in parallel." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Stop all labs
app.post('/api/labs/stop-all', async (req, res) => {
  try {
    const labs = db.getLabs();
    if (docker) {
      // Stop all lab containers concurrently in the background
      Promise.all(labs.map(async (lab) => {
        try {
          const container = docker.getContainer(lab.containerName);
          const inspectData = await container.inspect();
          if (inspectData.State.Running) {
            await container.stop({ t: 2 });
          }
        } catch (e) {}
        db.updateLab(lab.id, { active: false });
      })).catch(err => console.error("Error stopping all labs:", err));
    } else {
      for (const lab of labs) {
        db.updateLab(lab.id, { active: false });
      }
    }
    res.json({ success: true, message: "All lab containers are stopping in the background." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Reset Progress
app.post('/api/reset', async (req, res) => {
  try {
    const labs = db.getLabs();
    db.resetProgress(); // Reset progress instantly in DB

    if (docker) {
      // Stop all running lab containers concurrently in the background
      Promise.all(labs.map(async (lab) => {
        try {
          const container = docker.getContainer(lab.containerName);
          const inspectData = await container.inspect();
          if (inspectData.State.Running) {
            await container.stop({ t: 2 });
          }
        } catch (e) {}
      })).catch(err => console.error("Error stopping labs during reset:", err));
    }
    res.json({ success: true, message: "All progress reset. Containers are stopping in the background." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});



// API: Get Lab Hints
app.get('/api/labs/:id/hints', (req, res) => {
  const { id } = req.params;
  const hints = db.getHints(id);
  if (hints) {
    res.json({ success: true, hints });
  } else {
    res.status(404).json({ success: false, error: "Hints not found for this lab" });
  }
});

// API: Mini-Burp Request Proxy Relay
app.post('/api/proxy', async (req, res) => {
  const { method, url: targetUrl, headers, body } = req.body;
  
  if (!targetUrl) {
    return res.status(400).json({ success: false, error: "Target URL is required" });
  }

  try {
    const fetchOptions = {
      method: method || 'GET',
      headers: headers || {}
    };

    if (method && method !== 'GET' && method !== 'HEAD' && body !== undefined) {
      fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : String(body);
    }

    const startTime = Date.now();
    const response = await fetch(targetUrl, fetchOptions);
    const elapsed = Date.now() - startTime;

    const responseText = await response.text();
    
    // Convert headers entries to standard object
    const responseHeaders = {};
    response.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    res.json({
      success: true,
      status: response.status,
      statusText: response.statusText,
      elapsed,
      headers: responseHeaders,
      body: responseText
    });
  } catch (err) {
    console.error(`[Proxy Error] Failed to fetch ${targetUrl}:`, err.message);
    res.status(500).json({ success: false, error: `Proxy failed to connect to target: ${err.message}` });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Dashboard backend running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const parsedUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  if (pathname.startsWith('/ws/shell/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', async (ws, request) => {
  const parsedUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const containerName = parsedUrl.pathname.split('/').pop();

  if (!docker) {
    ws.send("\r\n\u001b[31m[Error] Docker daemon connection is unavailable on the host.\u001b[0m\r\n");
    ws.close();
    return;
  }

  try {
    const container = docker.getContainer(containerName);
    const inspectData = await container.inspect();
    if (!inspectData.State.Running) {
      ws.send("\r\n\u001b[31m[Error] Container is not running. Please start the lab first.\u001b[0m\r\n");
      ws.close();
      return;
    }

    // Spawn interactive shell (tty + stdin/stdout attached)
    const exec = await container.exec({
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: ['/bin/sh']
    });

    const stream = await exec.start({
      stdin: true,
      hijack: true
    });

    // Bind execution stream output directly to websocket client
    stream.on('data', (chunk) => {
      ws.send(chunk.toString());
    });

    // Bind websocket input directly to shell stdin
    ws.on('message', (message) => {
      const data = Buffer.isBuffer(message) ? message : Buffer.from(message);
      stream.write(data);
    });

    ws.on('close', () => {
      stream.end();
    });

    stream.on('end', () => {
      ws.close();
    });

    stream.on('error', (err) => {
      ws.send(`\r\n\u001b[31m[Error] Exec stream error: ${err.message}\u001b[0m\r\n`);
      ws.close();
    });

  } catch (err) {
    ws.send(`\r\n\u001b[31m[Error] Failed to connect to container: ${err.message}\u001b[0m\r\n`);
    ws.close();
  }
});
