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
exports.getLogger = getLogger;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
class Logger {
    constructor() {
        this.timers = new Map();
        this.channel = vscode.window.createOutputChannel('Trae Harvester Log');
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'trae-harvester.showLogs';
        const tmpDir = os.tmpdir();
        this.logFilePath = path.join(tmpDir, `trae_harvester_${Date.now()}.log`);
        this.channel.appendLine(`[Log File initialized at] ${this.logFilePath}`);
    }
    writeLine(level, tag, message, detail) {
        const timestamp = new Date().toISOString();
        let formatted = `[${timestamp}] [${level}] [${tag}] ${message}`;
        if (detail) {
            formatted += `\n    ${typeof detail === 'object' ? JSON.stringify(detail, null, 2) : String(detail)}`;
        }
        this.channel.appendLine(formatted);
        this.appendToFile(formatted);
    }
    separator(title) {
        const sep = '='.repeat(60);
        const msg = `\n${sep}\n> ${title}\n${sep}`;
        this.channel.appendLine(msg);
        this.appendToFile(msg);
    }
    subSeparator(title) {
        const sep = '-'.repeat(40);
        const msg = `\n${sep}\n>> ${title}\n${sep}`;
        this.channel.appendLine(msg);
        this.appendToFile(msg);
    }
    subEnd(status) {
        const msg = `<< End: ${status}\n` + '-'.repeat(40);
        this.channel.appendLine(msg);
        this.appendToFile(msg);
    }
    info(tag, message) {
        this.writeLine('INFO', tag, message);
    }
    debug(tag, message) {
        this.writeLine('DEBUG', tag, message);
    }
    warn(tag, message) {
        this.writeLine('WARN', tag, message);
    }
    error(tag, message, error) {
        this.writeLine('ERROR', tag, message, error instanceof Error ? error.stack || error.message : error);
        this.show();
    }
    detail(key, value) {
        const msg = `    * ${key}: ${value}`;
        this.channel.appendLine(msg);
        this.appendToFile(msg);
    }
    timerStart(id) {
        this.timers.set(id, Date.now());
    }
    timerEnd(id) {
        const start = this.timers.get(id);
        if (start) {
            const ms = Date.now() - start;
            this.info('Timer', `Task [${id}] took ${ms}ms`);
            this.timers.delete(id);
        }
    }
    setSuccess(message) {
        this.statusBarItem.text = `$(check) Trae Harvester: ${message}`;
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.show();
    }
    setError(message) {
        this.statusBarItem.text = `$(error) Trae Harvester: ${message}`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.statusBarItem.show();
    }
    show() {
        this.channel.show(true);
    }
    appendToFile(msg) {
        try {
            fs.appendFileSync(this.logFilePath, msg + '\n');
        }
        catch (e) { }
    }
    getLogFilePath() {
        return this.logFilePath;
    }
}
let loggerInstance = null;
function getLogger() {
    if (!loggerInstance) {
        loggerInstance = new Logger();
    }
    return loggerInstance;
}
//# sourceMappingURL=logger.js.map