import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { RegistryEntry, SessionStatus } from '../types';
import { getLogger } from './logger';

const REGISTRY_FILE = path.join(os.homedir(), '.trae-harvester-registry.json');

let currentEntry: RegistryEntry | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

function readRegistry(): Record<string, RegistryEntry> {
    try {
        if (fs.existsSync(REGISTRY_FILE)) {
            const data = fs.readFileSync(REGISTRY_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        getLogger().error('Registry', 'Failed to read registry', e);
    }
    return {};
}

function writeRegistry(registry: Record<string, RegistryEntry>) {
    try {
        fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf-8');
    } catch (e) {
        getLogger().error('Registry', 'Failed to write registry', e);
    }
}

/**
 * Register the current VS Code instance in the global registry.
 */
export function registerInstance(port: number, workspacePath: string) {
    currentEntry = {
        port,
        pid: process.pid,
        workspace: workspacePath,
        status: 'IDLE',
        last_heartbeat: Date.now()
    };
    
    updateRegistryEntry(currentEntry);

    // Start heartbeat
    if (heartbeatInterval) clearInterval(heartbeatInterval);
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
export function unregisterInstance() {
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
export function updateInstanceStatus(status: SessionStatus, modelId?: string, promptId?: string) {
    if (currentEntry) {
        currentEntry.status = status;
        if (modelId !== undefined) currentEntry.model_id = modelId;
        if (promptId !== undefined) currentEntry.prompt_id = promptId;
        currentEntry.last_heartbeat = Date.now();
        updateRegistryEntry(currentEntry);
    }
}

function updateRegistryEntry(entry: RegistryEntry) {
    const registry = readRegistry();
    
    // Clean up dead entries (no heartbeat for 60 seconds or dead pid)
    const now = Date.now();
    for (const key in registry) {
        const e = registry[key];
        if (now - e.last_heartbeat > 60000) {
            delete registry[key];
        } else {
            // Check if process is still alive
            try {
                process.kill(e.pid, 0);
            } catch (err) {
                // Process does not exist
                delete registry[key];
            }
        }
    }
    
    registry[entry.port.toString()] = entry;
    writeRegistry(registry);
}
