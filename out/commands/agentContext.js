"use strict";
// ============================================================
// Trae Harvester — 功能三：AI 上下文逆向提取
// ============================================================
// 数据流：定位 state.vscdb → 影子复制 → 查询 itemTable → 提取对话 → 输出 agent_context.json
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
exports.extractAgentContext = extractAgentContext;
exports.registerExtractContextCommand = registerExtractContextCommand;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const sqliteReader_1 = require("../utils/sqliteReader");
const fileUtils_1 = require("../utils/fileUtils");
const logger_1 = require("../utils/logger");
/**
 * 按平台推断 Trae 的 state.vscdb 默认路径。
 * 支持 Trae 和 VS Code 两种客户端。
 */
function getDefaultDbPath() {
    const platform = process.platform;
    // Trae 路径候选
    const candidates = [];
    if (platform === 'win32') {
        const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        candidates.push(path.join(appData, 'Trae', 'User', 'globalStorage', 'state.vscdb'), path.join(appData, 'Trae CN', 'User', 'globalStorage', 'state.vscdb'), path.join(appData, 'Trae', 'User', 'workspaceStorage'), path.join(appData, 'Code', 'User', 'globalStorage', 'state.vscdb'));
    }
    else if (platform === 'darwin') {
        const appSupport = path.join(os.homedir(), 'Library', 'Application Support');
        candidates.push(path.join(appSupport, 'Trae', 'User', 'globalStorage', 'state.vscdb'), path.join(appSupport, 'Trae CN', 'User', 'globalStorage', 'state.vscdb'), path.join(appSupport, 'Code', 'User', 'globalStorage', 'state.vscdb'));
    }
    else {
        // Linux
        const configDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
        candidates.push(path.join(configDir, 'Trae', 'User', 'globalStorage', 'state.vscdb'), path.join(configDir, 'Code', 'User', 'globalStorage', 'state.vscdb'));
    }
    // 返回第一个存在的路径
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    // 无法找到时返回最可能的路径
    return candidates[0] || '';
}
/**
 * 尝试从 itemTable 的值中提取 AI 对话数据。
 * Trae/VS Code 的 state.vscdb 中，AI 对话数据可能以多种 key 前缀存储。
 */
function extractSessionsFromItems(items) {
    const sessions = [];
    // 已知的 AI 对话相关 key 模式
    const aiKeyPatterns = [
        /chat/i,
        /conversation/i,
        /copilot/i,
        /ai.*session/i,
        /session.*ai/i,
        /agent/i,
        /assistant/i,
        /dialogue/i,
        /prompt/i,
        /trae.*builder/i,
    ];
    for (const item of items) {
        const isAiRelated = aiKeyPatterns.some(pattern => pattern.test(item.key));
        if (!isAiRelated) {
            continue;
        }
        try {
            const value = tryParseJson(item.value);
            if (!value) {
                continue;
            }
            // 尝试多种数据结构格式提取对话
            const extracted = tryExtractMessages(value, item.key);
            if (extracted && extracted.messages.length > 0) {
                sessions.push(extracted);
            }
        }
        catch {
            // 解析失败的条目跳过
            continue;
        }
    }
    return sessions;
}
/**
 * 安全解析 JSON，失败返回 null。
 */
function tryParseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
/**
 * 从不同的 JSON 结构中尝试提取对话消息。
 * 适配多种可能的存储格式。
 */
function tryExtractMessages(value, key) {
    const messages = [];
    // 格式一：直接的 messages 数组
    if (Array.isArray(value?.messages)) {
        for (const msg of value.messages) {
            messages.push(normalizeMessage(msg));
        }
    }
    // 格式二：对话轮次数组
    else if (Array.isArray(value?.turns)) {
        for (const turn of value.turns) {
            if (turn.request || turn.prompt) {
                messages.push({
                    role: 'user',
                    content: turn.request || turn.prompt || '',
                });
            }
            if (turn.response || turn.reply) {
                messages.push({
                    role: 'assistant',
                    content: turn.response || turn.reply || '',
                    thought_chain: turn.thought_chain || turn.thinking || turn.reasoning || undefined,
                });
            }
        }
    }
    // 格式三：嵌套在 data 字段中
    else if (value?.data) {
        const nested = tryExtractMessages(value.data, key);
        if (nested) {
            return nested;
        }
    }
    // 格式四：值本身是一个消息数组
    else if (Array.isArray(value)) {
        for (const item of value) {
            if (item.role && (item.content || item.text || item.message)) {
                messages.push(normalizeMessage(item));
            }
        }
    }
    // 格式五：单个对话记录
    else if (value?.role && (value?.content || value?.text)) {
        messages.push(normalizeMessage(value));
    }
    if (messages.length === 0) {
        return null;
    }
    return {
        session_id: key,
        timestamp: value?.timestamp || value?.created_at || value?.lastModified || undefined,
        messages,
    };
}
/**
 * 将不同格式的消息对象标准化。
 */
function normalizeMessage(msg) {
    return {
        role: normalizeRole(msg.role),
        content: msg.content || msg.text || msg.message || '',
        thought_chain: msg.thought_chain || msg.thinking || msg.reasoning || msg.thought || undefined,
    };
}
/**
 * 标准化角色名称。
 */
function normalizeRole(role) {
    const lower = (role || '').toLowerCase();
    if (lower.includes('user') || lower === 'human') {
        return 'user';
    }
    if (lower.includes('system')) {
        return 'system';
    }
    return 'assistant';
}
/**
 * 执行 AI 上下文提取的完整流程。
 */
async function extractAgentContext(outputDir, extensionPath, customDbPath) {
    // 确定数据库路径
    const dbPath = customDbPath || getDefaultDbPath();
    if (!dbPath) {
        throw new Error('无法定位 state.vscdb。请在设置中配置 traeHarvester.stateDbPath');
    }
    if (!fs.existsSync(dbPath)) {
        throw new Error(`数据库文件不存在: ${dbPath}\n请确认路径是否正确，或在设置中配置 traeHarvester.stateDbPath`);
    }
    // 使用结构化日志
    const log = (0, logger_1.getLogger)();
    log.separator('功能三：AI 上下文逆向提取');
    log.timerStart('extractContext');
    log.info('AgentContext', `数据库路径: ${dbPath}`);
    let tables;
    try {
        tables = await (0, sqliteReader_1.listTables)(dbPath, extensionPath);
        log.info('AgentContext', `发现的表: ${tables.join(', ')}`);
    }
    catch (err) {
        throw new Error(`读取数据库表结构失败: ${err.message}`);
    }
    // 查询 itemTable（VS Code/Trae 的主要 KV 存储表）
    const targetTable = tables.includes('ItemTable') ? 'ItemTable'
        : tables.includes('itemTable') ? 'itemTable'
            : tables.find(t => t.toLowerCase().includes('item'))
                || null;
    let sessions = [];
    if (targetTable) {
        log.info('AgentContext', `目标表: ${targetTable}`);
        try {
            const results = await (0, sqliteReader_1.shadowQuery)(dbPath, extensionPath, [`SELECT key, value FROM "${targetTable}";`]);
            const items = results[0] || [];
            log.info('AgentContext', `共读取 ${items.length} 条记录`);
            // 提取 AI 对话相关条目
            sessions = extractSessionsFromItems(items);
            log.info('AgentContext', `提取到 ${sessions.length} 个 AI 对话 Session`);
            if (sessions.length > 0) {
                for (const session of sessions) {
                    log.detail(`Session ${session.session_id}`, `${session.messages.length} 条消息`);
                }
            }
        }
        catch (err) {
            log.error('AgentContext', `查询 ${targetTable} 失败`, err);
            throw new Error(`查询 ${targetTable} 失败: ${err.message}`);
        }
    }
    else {
        log.warn('AgentContext', '未找到 itemTable，尝试遍历所有表');
        // 尝试从所有表中查找对话数据
        for (const table of tables) {
            try {
                const results = await (0, sqliteReader_1.shadowQuery)(dbPath, extensionPath, [`SELECT * FROM "${table}" LIMIT 100;`]);
                // 检查是否有 key-value 结构
                const rows = results[0] || [];
                if (rows.length > 0 && 'key' in rows[0] && 'value' in rows[0]) {
                    const extracted = extractSessionsFromItems(rows);
                    sessions.push(...extracted);
                }
            }
            catch {
                continue;
            }
        }
    }
    // 构建输出
    const output = {
        timestamp: new Date().toISOString(),
        source_db: dbPath,
        extraction_note: sessions.length > 0
            ? `成功提取 ${sessions.length} 个 AI 对话 Session`
            : '未能从数据库中提取到 AI 对话数据。可能需要调整 key 匹配模式或确认数据库路径',
        sessions,
    };
    // 写入 agent_context.json
    const outputPath = path.join(outputDir, 'agent_context.json');
    await (0, fileUtils_1.writeJson)(outputPath, output);
    log.info('AgentContext', `已写入: ${outputPath}`);
    log.timerEnd('extractContext');
    log.setSuccess('AI 上下文提取完成');
    log.show();
    return outputPath;
}
/**
 * 注册 AI 上下文提取命令。
 */
function registerExtractContextCommand(context) {
    return vscode.commands.registerCommand('trae-harvester.extractContext', async () => {
        try {
            const config = vscode.workspace.getConfiguration('traeHarvester');
            const outputPath = config.get('outputPath', '/gitdiff_shared');
            const customDbPath = config.get('stateDbPath', '') || undefined;
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Trae Harvester: 提取 AI 上下文中...',
                cancellable: false,
            }, async () => {
                const resultPath = await extractAgentContext(outputPath, context.extensionPath, customDbPath);
                vscode.window.showInformationMessage(`✅ AI 上下文已提取: ${resultPath}`);
            });
        }
        catch (err) {
            const log = (0, logger_1.getLogger)();
            log.error('AgentContext', 'AI 上下文提取失败', err);
            log.setError('AI 上下文提取失败');
            vscode.window.showErrorMessage(`❌ AI 上下文提取失败: ${err.message}`);
        }
    });
}
//# sourceMappingURL=agentContext.js.map