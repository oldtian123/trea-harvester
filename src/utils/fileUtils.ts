// ============================================================
// Trae Harvester — 文件读写工具 (File Utilities)
// ============================================================
// 提供递归目录创建、原子写入等文件操作的健壮封装。

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * 递归创建目录（等价于 mkdir -p）。
 * 如果目录已存在则不报错。
 */
export async function ensureDir(dirPath: string): Promise<void> {
    try {
        await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (err: any) {
        // EEXIST 可以安全忽略
        if (err.code !== 'EEXIST') {
            throw new Error(`无法创建目录 ${dirPath}: ${err.message}`);
        }
    }
}

/**
 * 原子写入文件：先写入临时文件，再 rename 到目标路径。
 * 防止写入过程中断导致文件损坏。
 * 
 * @param filePath  目标文件绝对路径
 * @param content   文件内容
 */
export async function atomicWrite(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await ensureDir(dir);

    // 在目标目录下创建临时文件（确保在同一文件系统上，rename 才是原子操作）
    const tempFile = path.join(dir, `.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`);

    try {
        await fs.promises.writeFile(tempFile, content, 'utf-8');
        await fs.promises.rename(tempFile, filePath);
    } catch (err: any) {
        // 清理临时文件
        try {
            await fs.promises.unlink(tempFile);
        } catch {
            // 临时文件可能已不存在，忽略
        }
        throw new Error(`原子写入失败 ${filePath}: ${err.message}`);
    }
}

/**
 * 安全地将 JSON 对象写入文件（格式化的 JSON + 原子写入）。
 */
export async function writeJson(filePath: string, data: unknown): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    await atomicWrite(filePath, content);
}

/**
 * 安全读取文件内容。
 * 文件不存在时返回 null 而非抛出异常。
 */
export async function safeReadFile(filePath: string): Promise<string | null> {
    try {
        return await fs.promises.readFile(filePath, 'utf-8');
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            return null;
        }
        throw err;
    }
}

/**
 * 安全复制文件。
 * 会自动创建目标目录。
 */
export async function safeCopy(src: string, dest: string): Promise<void> {
    const dir = path.dirname(dest);
    await ensureDir(dir);
    await fs.promises.copyFile(src, dest);
}

/**
 * 获取系统临时目录下的一个唯一子目录路径。
 */
export function getTempDir(prefix: string = 'trae-harvester'): string {
    return path.join(os.tmpdir(), `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`);
}

/**
 * 安全删除文件。不存在时不报错。
 */
export async function safeUnlink(filePath: string): Promise<void> {
    try {
        await fs.promises.unlink(filePath);
    } catch (err: any) {
        if (err.code !== 'ENOENT') {
            throw err;
        }
    }
}
