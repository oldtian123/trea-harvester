"use strict";
// ============================================================
// Trae Harvester — SQLite 影子模式读取器
// ============================================================
// 安全地读取可能被锁定的 SQLite 数据库：
// 1. 将数据库文件复制到临时目录（影子复制）
// 2. 以只读方式打开影子副本
// 3. 查询完毕后清理临时文件
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
exports.shadowQuery = shadowQuery;
exports.listTables = listTables;
exports.getTableColumns = getTableColumns;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fileUtils_1 = require("./fileUtils");
// sql.js 使用动态 import 以支持 WASM 加载
let initSqlJsModule = null;
/**
 * 延迟加载 sql.js 模块
 */
async function loadSqlJs(extensionPath) {
    if (!initSqlJsModule) {
        // 动态 require sql.js
        const initSqlJs = require('sql.js');
        // 尝试定位 WASM 文件
        const wasmPaths = [
            path.join(extensionPath, 'out', 'sql-wasm.wasm'),
            path.join(extensionPath, 'dist', 'sql-wasm.wasm'),
            path.join(extensionPath, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
        ];
        let wasmBinary;
        for (const wp of wasmPaths) {
            try {
                if (fs.existsSync(wp)) {
                    wasmBinary = fs.readFileSync(wp);
                    break;
                }
            }
            catch {
                continue;
            }
        }
        if (wasmBinary) {
            initSqlJsModule = await initSqlJs({ wasmBinary });
        }
        else {
            // 回退：让 sql.js 自己找 WASM（可能通过 fetch）
            initSqlJsModule = await initSqlJs();
        }
    }
    return initSqlJsModule;
}
/**
 * 影子模式读取 SQLite 数据库。
 *
 * 流程：
 * 1. 将源数据库复制到临时目录
 * 2. 使用 sql.js 只读打开
 * 3. 执行查询
 * 4. 关闭并清理
 *
 * @param dbPath        源数据库绝对路径
 * @param extensionPath 扩展安装路径（用于定位 WASM）
 * @param queries       要执行的 SQL 查询列表
 * @returns             每条查询对应的结果行数组
 */
async function shadowQuery(dbPath, extensionPath, queries) {
    // 验证源文件存在
    if (!fs.existsSync(dbPath)) {
        throw new Error(`数据库文件不存在: ${dbPath}`);
    }
    // 创建临时目录并复制数据库
    const tempDir = (0, fileUtils_1.getTempDir)('trae-sqlite');
    await (0, fileUtils_1.ensureDir)(tempDir);
    const shadowPath = path.join(tempDir, 'state_shadow.vscdb');
    try {
        // 影子复制：复制主数据库文件
        await (0, fileUtils_1.safeCopy)(dbPath, shadowPath);
        // 同时复制 WAL 和 SHM 文件（如果存在）
        for (const suffix of ['-wal', '-shm']) {
            const srcExtra = dbPath + suffix;
            if (fs.existsSync(srcExtra)) {
                try {
                    await (0, fileUtils_1.safeCopy)(srcExtra, shadowPath + suffix);
                }
                catch {
                    // WAL/SHM 文件复制失败不阻塞主流程
                }
            }
        }
        // 加载 sql.js
        const SQL = await loadSqlJs(extensionPath);
        // 读取影子数据库
        const fileBuffer = fs.readFileSync(shadowPath);
        const db = new SQL.Database(new Uint8Array(fileBuffer));
        const results = [];
        try {
            for (const sql of queries) {
                try {
                    const queryResults = db.exec(sql);
                    if (queryResults.length === 0) {
                        results.push([]);
                    }
                    else {
                        // 将 columns + values 转换为对象数组
                        const columns = queryResults[0].columns;
                        const rows = queryResults[0].values.map((row) => {
                            const obj = {};
                            columns.forEach((col, i) => {
                                obj[col] = row[i];
                            });
                            return obj;
                        });
                        results.push(rows);
                    }
                }
                catch (queryErr) {
                    // 单条查询失败不阻塞其他查询
                    results.push([]);
                    console.error(`SQL 查询失败: ${sql}`, queryErr.message);
                }
            }
        }
        finally {
            db.close();
        }
        return results;
    }
    finally {
        // 清理临时文件
        try {
            await (0, fileUtils_1.safeUnlink)(shadowPath);
            await (0, fileUtils_1.safeUnlink)(shadowPath + '-wal');
            await (0, fileUtils_1.safeUnlink)(shadowPath + '-shm');
            await fs.promises.rmdir(tempDir);
        }
        catch {
            // 清理失败不阻塞
        }
    }
}
/**
 * 列出数据库中所有表名（用于探索未知数据库结构）。
 */
async function listTables(dbPath, extensionPath) {
    const results = await shadowQuery(dbPath, extensionPath, ["SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"]);
    return results[0]?.map(row => row.name) ?? [];
}
/**
 * 获取指定表的所有列名。
 */
async function getTableColumns(dbPath, extensionPath, tableName) {
    const results = await shadowQuery(dbPath, extensionPath, [`PRAGMA table_info('${tableName}');`]);
    return results[0]?.map(row => row.name) ?? [];
}
//# sourceMappingURL=sqliteReader.js.map