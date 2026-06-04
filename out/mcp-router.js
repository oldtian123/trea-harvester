#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const REGISTRY_FILE = path.join(os.homedir(), '.trae-harvester-registry.json');

// --- Helper Functions ---

function getRegistry() {
    try {
        if (fs.existsSync(REGISTRY_FILE)) {
            const data = fs.readFileSync(REGISTRY_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        // Ignore
    }
    return {};
}

async function fetchFromPort(port, method, params) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: method,
            params: params
        });

        const req = http.request({
            hostname: 'localhost',
            port: port,
            path: '/mcp',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error("Invalid JSON response from worker node"));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(payload);
        req.end();
    });
}

// --- MCP Server Implementation ---

function sendResponse(id, result, error = null) {
    const response = {
        jsonrpc: "2.0",
        id: id
    };
    if (error) {
        response.error = error;
    } else {
        response.result = result;
    }
    process.stdout.write(JSON.stringify(response) + "\n");
}

function handleInitialize(id) {
    sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: {},
        serverInfo: {
            name: "TraeHarvesterAggregatorRouter",
            version: "1.0.0"
        }
    });
}

function handleToolsList(id) {
    sendResponse(id, {
        tools: [
            {
                name: "trea_harvester_list_windows",
                description: "List all active VS Code windows running Trae Harvester, showing their session_id (port), model identifier, prompt identifier, and test completion status.",
                inputSchema: {
                    type: "object",
                    properties: {}
                }
            },
            {
                name: "trea_harvester_get_evidence",
                description: "Retrieve the evaluation evidence (Git Patch and test results) from a specific COMPLETED VS Code window by its session_id.",
                inputSchema: {
                    type: "object",
                    properties: {
                        session_id: {
                            type: "string",
                            description: "The session_id (port) of the target VS Code window."
                        }
                    },
                    required: ["session_id"]
                }
            }
        ]
    });
}

async function handleToolsCall(id, params) {
    const { name, arguments: args } = params;

    if (name === "trea_harvester_list_windows") {
        const registry = getRegistry();
        const windows = [];
        for (const port in registry) {
            const entry = registry[port];
            // Filter dead entries gracefully
            if (Date.now() - entry.last_heartbeat < 120000) {
                windows.push({
                    session_id: port,
                    model: entry.model_id || "None",
                    prompt: entry.prompt_id || "None",
                    status: entry.status || "IDLE",
                    workspace: entry.workspace
                });
            }
        }
        sendResponse(id, {
            content: [{ type: "text", text: JSON.stringify(windows, null, 2) }]
        });
        return;
    }

    if (name === "trea_harvester_get_evidence") {
        const sessionId = args.session_id;
        if (!sessionId) {
            sendResponse(id, null, { code: -32602, message: "Missing session_id parameter" });
            return;
        }

        const registry = getRegistry();
        if (!registry[sessionId]) {
            sendResponse(id, {
                content: [{ type: "text", text: `Error: Session ${sessionId} not found or inactive.` }],
                isError: true
            });
            return;
        }

        try {
            // Proxy the request to the worker node
            const response = await fetchFromPort(parseInt(sessionId), "tools/call", {
                name: "trea_harvester_get_evaluation_evidence",
                arguments: {}
            });
            
            if (response.error) {
                sendResponse(id, {
                    content: [{ type: "text", text: `Worker error: ${response.error.message}` }],
                    isError: true
                });
            } else {
                sendResponse(id, response.result);
            }
        } catch (e) {
            sendResponse(id, {
                content: [{ type: "text", text: `Failed to communicate with session ${sessionId}: ${e.message}` }],
                isError: true
            });
        }
        return;
    }

    sendResponse(id, null, { code: -32601, message: "Method not found" });
}

// --- Stdio Message Loop ---

let buffer = '';
process.stdin.on('data', async (chunk) => {
    buffer += chunk.toString();
    let boundary = buffer.indexOf('\n');
    while (boundary !== -1) {
        const line = buffer.substring(0, boundary).trim();
        buffer = buffer.substring(boundary + 1);
        boundary = buffer.indexOf('\n');

        if (!line) continue;

        try {
            const message = JSON.parse(line);
            
            if (message.method === "initialize") {
                handleInitialize(message.id);
            } else if (message.method === "tools/list") {
                handleToolsList(message.id);
            } else if (message.method === "tools/call") {
                await handleToolsCall(message.id, message.params);
            } else if (message.id) {
                // Ignore other methods but return empty success to satisfy protocol
                sendResponse(message.id, {});
            }
        } catch (e) {
            // Invalid message
        }
    }
});
