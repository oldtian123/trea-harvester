import * as vscode from 'vscode';
import * as fs from 'fs';
import { getLogger } from '../utils/logger';
import { resolveOutputPath } from '../utils/pathResolver';

export function registerDiagnosticsCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
    const showLogsCmd = vscode.commands.registerCommand('trae-harvester.showLogs', () => {
        getLogger().show();
    });

    const runDiagCmd = vscode.commands.registerCommand('trae-harvester.runDiagnostics', async () => {
        const log = getLogger();
        log.separator('运行环境诊断 (Diagnostics)');
        log.timerStart('diagnostics');
        
        try {
            log.info('System', `平台: ${process.platform}, 架构: ${process.arch}`);
            log.info('System', `Node: ${process.version}`);
            
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            log.info('Workspace', `当前工作区: ${workspaceFolder || '无'}`);

            const config = vscode.workspace.getConfiguration('traeHarvester');
            log.info('Config', `patch 输出目录: ${resolveOutputPath('patch')}`);
            log.info('Config', `results 输出目录: ${resolveOutputPath('results')}`);
            log.info('Config', `commandTimeout: ${config.get('commandTimeout')}ms`);

            // Check git installation
            try {
                const { execCommand } = require('../utils/shell');
                const gitRes = await execCommand('git --version');
                log.info('Git', `安装信息: ${gitRes.stdout.trim()}`);
            } catch (e: any) {
                log.warn('Git', `执行 Git 命令失败: ${e.message}`);
            }

            
            log.setSuccess('诊断已完成');
            log.info('Diagnostics', `日志文件保存在: ${log.getLogFilePath()}`);
        } catch (err: any) {
            log.error('Diagnostics', '诊断执行失败', err);
            log.setError('诊断失败');
        } finally {
            log.timerEnd('diagnostics');
            log.show();
        }
    });

    const exportLogsCmd = vscode.commands.registerCommand('trae-harvester.exportLogs', async () => {
        const log = getLogger();
        try {
            const outputPath = resolveOutputPath('results');

            if (!fs.existsSync(outputPath)) {
                fs.mkdirSync(outputPath, { recursive: true });
            }
            
            const srcPath = log.getLogFilePath();
            const destPath = require('path').join(outputPath, `trae_harvester_log_${Date.now()}.txt`);
            
            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, destPath);
                vscode.window.showInformationMessage(`✅ 日志已成功导出至: ${destPath}`);
                log.info('Diagnostics', `日志文件导出成功: ${destPath}`);
            } else {
                vscode.window.showWarningMessage('⚠️ 未找到当前运行的日志文件。');
            }
        } catch (err: any) {
            log.error('Diagnostics', '日志导出失败', err);
            vscode.window.showErrorMessage(`❌ 日志导出失败: ${err.message}`);
        }
    });

    return [showLogsCmd, runDiagCmd, exportLogsCmd];
}
