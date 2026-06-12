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
exports.registerDiagnosticsCommands = registerDiagnosticsCommands;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const logger_1 = require("../utils/logger");
const pathResolver_1 = require("../utils/pathResolver");
function registerDiagnosticsCommands(context) {
    const showLogsCmd = vscode.commands.registerCommand('trae-harvester.showLogs', () => {
        (0, logger_1.getLogger)().show();
    });
    const runDiagCmd = vscode.commands.registerCommand('trae-harvester.runDiagnostics', async () => {
        const log = (0, logger_1.getLogger)();
        log.separator('运行环境诊断 (Diagnostics)');
        log.timerStart('diagnostics');
        try {
            log.info('System', `平台: ${process.platform}, 架构: ${process.arch}`);
            log.info('System', `Node: ${process.version}`);
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            log.info('Workspace', `当前工作区: ${workspaceFolder || '无'}`);
            const config = vscode.workspace.getConfiguration('traeHarvester');
            log.info('Config', `patch 输出目录: ${(0, pathResolver_1.resolveOutputPath)('patch')}`);
            log.info('Config', `results 输出目录: ${(0, pathResolver_1.resolveOutputPath)('results')}`);
            log.info('Config', `commandTimeout: ${config.get('commandTimeout')}ms`);
            // Check git installation
            try {
                const { execCommand } = require('../utils/shell');
                const gitRes = await execCommand('git --version');
                log.info('Git', `安装信息: ${gitRes.stdout.trim()}`);
            }
            catch (e) {
                log.warn('Git', `执行 Git 命令失败: ${e.message}`);
            }
            log.setSuccess('诊断已完成');
            log.info('Diagnostics', `日志文件保存在: ${log.getLogFilePath()}`);
        }
        catch (err) {
            log.error('Diagnostics', '诊断执行失败', err);
            log.setError('诊断失败');
        }
        finally {
            log.timerEnd('diagnostics');
            log.show();
        }
    });
    const exportLogsCmd = vscode.commands.registerCommand('trae-harvester.exportLogs', async () => {
        const log = (0, logger_1.getLogger)();
        try {
            const outputPath = (0, pathResolver_1.resolveOutputPath)('results');
            if (!fs.existsSync(outputPath)) {
                fs.mkdirSync(outputPath, { recursive: true });
            }
            const srcPath = log.getLogFilePath();
            const destPath = require('path').join(outputPath, `trae_harvester_log_${Date.now()}.txt`);
            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, destPath);
                vscode.window.showInformationMessage(`✅ 日志已成功导出至: ${destPath}`);
                log.info('Diagnostics', `日志文件导出成功: ${destPath}`);
            }
            else {
                vscode.window.showWarningMessage('⚠️ 未找到当前运行的日志文件。');
            }
        }
        catch (err) {
            log.error('Diagnostics', '日志导出失败', err);
            vscode.window.showErrorMessage(`❌ 日志导出失败: ${err.message}`);
        }
    });
    return [showLogsCmd, runDiagCmd, exportLogsCmd];
}
//# sourceMappingURL=diagnostics.js.map