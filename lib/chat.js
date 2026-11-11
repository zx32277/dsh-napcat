import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** 会话标识、准入策略、session id 派生。 */
/** 从消息事件算出会话（私聊=用户 QQ，群聊=群号）。 */
export function chatRefOf(event) {
    const kind = event.message_type;
    if (kind !== 'private' && kind !== 'group')
        return undefined;
    if (kind === 'private') {
        const id = String(event.user_id ?? '');
        return id === '' ? undefined : { kind, id, key: 'private:' + id };
    }
    const id = String(event.group_id ?? '');
    return id === '' ? undefined : { kind, id, key: 'group:' + id };
}
export function isAdmin(config, userId) {
    return config.adminUsers.map(value => value.trim()).filter(value => value !== '').includes(userId);
}
/** 这个会话/发送方是否允许进入模型（返回 false 时静默丢弃，只打 debug 日志）。 */
export function allowAccess(config, chat, userId) {
    if (chat.kind === 'private') {
        if (config.dmPolicy === 'disabled')
            return false;
        if (config.dmPolicy === 'admin')
            return isAdmin(config, userId);
        const allow = config.allowFrom.map(value => value.trim()).filter(value => value !== '');
        return allow.length === 0 || allow.includes(userId);
    }
    if (config.groupPolicy === 'disabled')
        return false;
    if (config.groupPolicy === 'allowlist') {
        const allow = config.groupAllowFrom.map(value => value.trim()).filter(value => value !== '');
        return allow.includes(chat.id);
    }
    return true;
}
/**
 * 每个 QQ 会话一个稳定的 session id：
 * 重启后 create 会因同 id 的已持久化日志而失败，Bridge 会回退到 resume，
 * 于是同一 QQ 会话自然续上原来的上下文。
 */
export function sessionIdForChat(key) {
    const base = 'napcat-' + key.replace(/[^A-Za-z0-9_-]/g, '-');
    // AKI-SESSION-TAG：换脑开关。
    // 读 ~/.dsh/fish/session-tag.txt；有合法 tag 就拼到会话 id 后面。
    // tag 一变 → 会话 id 变 → 宿主 create 出新会话（旧会话文件都还在，随时能退回）。
    try {
        const tag = readFileSync(join(homedir(), '.dsh', 'fish', 'session-tag.txt'), 'utf8').trim();
        if (tag !== '' && /^[A-Za-z0-9_-]+$/.test(tag))
            return base + '-' + tag;
    }
    catch { }
    return base;
}
