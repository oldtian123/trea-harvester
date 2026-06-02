"use strict";
// ============================================================
// Trae Harvester — 文件读写工具 (File Utilities)
// ============================================================
// 提供递归目录创建、原子写入等文件操作的健壮封装。
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
exports.ensureDir = ensureDir;
exports.atomicWrite = atomicWrite;
exports.writeJson = writeJson;
exports.safeReadFile = safeReadFile;
exports.safeCopy = safeCopy;
exports.getTempDir = getTempDir;
exports.safeUnlink = safeUnlink;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * 递归创建目录（等价于 mkdir -p）。
 * 如果目录已存在则不报错。
 */
async function ensureDir(dirPath) {
    try {
        await fs.promises.mkdir(dirPath, { recursive: true });
    }
    catch (err) {
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
async function atomicWrite(filePath, content) {
    const dir = path.dirname(filePath);
    await ensureDir(dir);
    // 在目标目录下创建临时文件（确保在同一文件系统上，rename 才是原子操作）
    const tempFile = path.join(dir, `.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    try {
        await fs.promises.writeFile(tempFile, content, 'utf-8');
        await fs.promises.rename(tempFile, filePath);
    }
    catch (err) {
        // 清理临时文件
        try {
            await fs.promises.unlink(tempFile);
        }
        catch {
            // 临时文件可能已不存在，忽略
        }
        throw new Error(`原子写入失败 ${filePath}: ${err.message}`);
    }
}
/**
 * 安全地将 JSON 对象写入文件（格式化的 JSON + 原子写入）。
 */
async function writeJson(filePath, data) {
    const content = JSON.stringify(data, null, 2);
    await atomicWrite(filePath, content);
}
/**
 * 安全读取文件内容。
 * 文件不存在时返回 null 而非抛出异常。
 */
async function safeReadFile(filePath) {
    try {
        return await fs.promises.readFile(filePath, 'utf-8');
    }
    catch (err) {
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
async function safeCopy(src, dest) {
    const dir = path.dirname(dest);
    await ensureDir(dir);
    await fs.promises.copyFile(src, dest);
}
/**
 * 获取系统临时目录下的一个唯一子目录路径。
 */
function getTempDir(prefix = 'trae-harvester') {
    return path.join(os.tmpdir(), `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`);
}
/**
 * 安全删除文件。不存在时不报错。
 */
async function safeUnlink(filePath) {
    try {
        await fs.promises.unlink(filePath);
    }
    catch (err) {
        if (err.code !== 'ENOENT') {
            throw err;
        }
    }
}
//# sourceMappingURL=fileUtils.js.map