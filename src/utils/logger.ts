import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

class Logger {
    public readonly channel: vscode.OutputChannel;
    public readonly statusBarItem: vscode.StatusBarItem;
    private readonly logFilePath: string;
    private timers: Map<string, number> = new Map();

    constructor() {
        this.channel = vscode.window.createOutputChannel('Trae Harvester Log');
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'trae-harvester.showLogs';
        
        const tmpDir = os.tmpdir();
        this.logFilePath = path.join(tmpDir, `trae_harvester_${Date.now()}.log`);
        
        this.channel.appendLine(`[Log File initialized at] ${this.logFilePath}`);
    }

    private writeLine(level: string, tag: string, message: string, detail?: any) {
        const timestamp = new Date().toISOString();
        let formatted = `[${timestamp}] [${level}] [${tag}] ${message}`;
        if (detail) {
            formatted += `\n    ${typeof detail === 'object' ? JSON.stringify(detail, null, 2) : String(detail)}`;
        }
        
        this.channel.appendLine(formatted);
        this.appendToFile(formatted);
    }

    public separator(title: string) {
        const sep = '='.repeat(60);
        const msg = `\n${sep}\n> ${title}\n${sep}`;
        this.channel.appendLine(msg);
        this.appendToFile(msg);
    }

    public subSeparator(title: string) {
        const sep = '-'.repeat(40);
        const msg = `\n${sep}\n>> ${title}\n${sep}`;
        this.channel.appendLine(msg);
        this.appendToFile(msg);
    }
    
    public subEnd(status: string) {
        const msg = `<< End: ${status}\n` + '-'.repeat(40);
        this.channel.appendLine(msg);
        this.appendToFile(msg);
    }

    public info(tag: string, message: string) {
        this.writeLine('INFO', tag, message);
    }

    public debug(tag: string, message: string) {
        this.writeLine('DEBUG', tag, message);
    }

    public warn(tag: string, message: string) {
        this.writeLine('WARN', tag, message);
    }

    public error(tag: string, message: string, error?: any) {
        this.writeLine('ERROR', tag, message, error instanceof Error ? error.stack || error.message : error);
        this.show();
    }

    public detail(key: string, value: string) {
        const msg = `    * ${key}: ${value}`;
        this.channel.appendLine(msg);
        this.appendToFile(msg);
    }

    public timerStart(id: string) {
        this.timers.set(id, Date.now());
    }

    public timerEnd(id: string) {
        const start = this.timers.get(id);
        if (start) {
            const ms = Date.now() - start;
            this.info('Timer', `Task [${id}] took ${ms}ms`);
            this.timers.delete(id);
        }
    }

    public setSuccess(message: string) {
        this.statusBarItem.text = `$(check) Trae Harvester: ${message}`;
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.show();
    }

    public setError(message: string) {
        this.statusBarItem.text = `$(error) Trae Harvester: ${message}`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.statusBarItem.show();
    }

    public show() {
        this.channel.show(true);
    }

    private appendToFile(msg: string) {
        try { fs.appendFileSync(this.logFilePath, msg + '\n'); } catch (e) {}
    }

    public getLogFilePath() {
        return this.logFilePath;
    }
}

let loggerInstance: Logger | null = null;
export function getLogger(): Logger {
    if (!loggerInstance) {
        loggerInstance = new Logger();
    }
    return loggerInstance;
}
