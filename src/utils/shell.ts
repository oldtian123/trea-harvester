// ============================================================
// Trae Harvester — 子进程封装 (Shell Utilities)
// ============================================================
// 提供 exec 和 spawn 的 Promise 封装，支持超时保护和完整输出捕获。

import { exec, spawn, ExecOptions, SpawnOptions } from 'child_process';
import { CommandResult } from '../types';

/**
 * 基于 exec 的命令执行（适合短命令，stdout/stderr 缓冲在内存中）。
 * 
 * @param command   要执行的 shell 命令字符串
 * @param options   exec 选项（cwd, env, timeout 等）
 * @returns         包含 stdout, stderr, exitCode 的结果
 */
export function execCommand(
    command: string,
    options: ExecOptions = {}
): Promise<CommandResult> {
    return new Promise((resolve) => {
        // 设置默认 maxBuffer 为 50MB，防止大输出被截断
        const opts: ExecOptions = {
            maxBuffer: 50 * 1024 * 1024,
            ...options,
        };

        const child = exec(command, opts, (error, stdout, stderr) => {
            resolve({
                stdout: stdout?.toString() ?? '',
                stderr: stderr?.toString() ?? '',
                exitCode: error ? (error as any).code ?? 1 : 0,
                timedOut: false,
            });
        });

        // 超时保护：如果 options.timeout 已由 exec 内部处理，但我们额外标记
        child.on('error', () => {
            // exec callback 已经处理了错误，这里不重复 resolve
        });
    });
}

/**
 * 基于 spawn 的命令执行（适合长时间运行的命令，流式捕获输出）。
 * 
 * @param command   命令名称
 * @param args      命令参数数组
 * @param options   spawn 选项
 * @param timeoutMs 超时时间(ms)，0 表示不超时
 * @returns         包含完整 stdout, stderr, exitCode 的结果
 */
export function spawnCommand(
    command: string,
    args: string[] = [],
    options: SpawnOptions = {},
    timeoutMs: number = 0
): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        let settled = false;

        const child = spawn(command, args, {
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            ...options,
        });

        // 超时定时器
        let timer: NodeJS.Timeout | undefined;
        if (timeoutMs > 0) {
            timer = setTimeout(() => {
                timedOut = true;
                child.kill('SIGTERM');
                // 给进程 5 秒优雅退出
                setTimeout(() => {
                    if (!settled) {
                        child.kill('SIGKILL');
                    }
                }, 5000);
            }, timeoutMs);
        }

        child.stdout?.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        child.stderr?.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            settled = true;
            if (timer) {
                clearTimeout(timer);
            }
            resolve({
                stdout,
                stderr,
                exitCode: code,
                timedOut,
            });
        });

        child.on('error', (err) => {
            settled = true;
            if (timer) {
                clearTimeout(timer);
            }
            resolve({
                stdout,
                stderr: stderr + '\n' + err.message,
                exitCode: -1,
                timedOut: false,
            });
        });
    });
}

/**
 * 在指定的 shell 中执行完整的命令字符串（支持管道、重定向等）。
 * 使用 spawn + shell:true 来获得流式输出。
 * 
 * @param fullCommand  完整的命令字符串（如 "npm run test 2>&1"）
 * @param cwd          工作目录
 * @param timeoutMs    超时时间(ms)
 */
export function runShellCommand(
    fullCommand: string,
    cwd?: string,
    timeoutMs: number = 0
): Promise<CommandResult> {
    // spawnCommand 内部已经设置了 shell: true
    // 因此不需要再手动包裹 cmd.exe /c 或 /bin/sh -c，否则会导致参数截断或丢失
    return spawnCommand(fullCommand, [], { cwd }, timeoutMs);
}
