"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInstance = registerInstance;
exports.unregisterInstance = unregisterInstance;
exports.updateInstanceStatus = updateInstanceStatus;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("./logger");
const REGISTRY_FILE = path.join(os.homedir(), '.trae-harvester-registry.json');
let currentEntry = null;
let heartbeatInterval = null;
function readRegistry() {
    try {
        if (fs.existsSync(REGISTRY_FILE)) {
            const data = fs.readFileSync(REGISTRY_FILE, 'utf-8');
            return JSON.parse(data);
        }
    }
    catch (e) {
        (0, logger_1.getLogger)().error('Registry', 'Failed to read registry', e);
    }
    return {};
}
function writeRegistry(registry) {
    try {
        fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf-8');
    }
    catch (e) {
        (0, logger_1.getLogger)().error('Registry', 'Failed to write registry', e);
    }
}
/**
 * Register the current VS Code instance in the global registry.
 */
function registerInstance(port, workspacePath) {
    currentEntry = {
        port,
        pid: process.pid,
        workspace: workspacePath,
        status: 'IDLE',
        last_heartbeat: Date.now()
    };
    updateRegistryEntry(currentEntry);
    // Start heartbeat
    if (heartbeatInterval)
        clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        if (currentEntry) {
            currentEntry.last_heartbeat = Date.now();
            updateRegistryEntry(currentEntry);
        }
    }, 15000); // 15s heartbeat
}
/**
 * Unregister the current instance.
 */
function unregisterInstance() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    if (currentEntry) {
        const registry = readRegistry();
        delete registry[currentEntry.port.toString()];
        writeRegistry(registry);
        currentEntry = null;
    }
}
/**
 * Update the status and identifiers for the current instance.
 */
function updateInstanceStatus(status, modelId, promptId) {
    if (currentEntry) {
        currentEntry.status = status;
        if (modelId !== undefined)
            currentEntry.model_id = modelId;
        if (promptId !== undefined)
            currentEntry.prompt_id = promptId;
        currentEntry.last_heartbeat = Date.now();
        updateRegistryEntry(currentEntry);
    }
}
function updateRegistryEntry(entry) {
    const registry = readRegistry();
    // Clean up dead entries (no heartbeat for 60 seconds or dead pid)
    const now = Date.now();
    for (const key in registry) {
        const e = registry[key];
        if (now - e.last_heartbeat > 60000) {
            delete registry[key];
        }
        else {
            // Check if process is still alive
            try {
                process.kill(e.pid, 0);
            }
            catch (err) {
                // Process does not exist
                delete registry[key];
            }
        }
    }
    registry[entry.port.toString()] = entry;
    writeRegistry(registry);
}
//# sourceMappingURL=registry.js.map