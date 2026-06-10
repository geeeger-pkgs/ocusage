/**
 * 从 Trae 进程内存中提取 SQLCipher 4 密钥。
 *
 * 通过 PowerShell 脚本 (scripts/extract-trae-key.ps1) 调用 Windows API
 * 读取 Trae 进程内存，搜索 hex 格式密钥候选，再用 Node.js crypto 做 HMAC 验证。
 *
 * 只在 Windows 平台生效，macOS/Linux 返回 null。
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFirstPage, verifyEncKey } from "./trae-crypto.mjs";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const isWindows = process.platform === "win32";

/**
 * 从 Trae 进程内存中提取并验证 SQLCipher 密钥。
 *
 * PowerShell 脚本返回盐值匹配的候选 hex 密钥，
 * 本函数用 Node.js crypto 对每个候选做 HMAC-SHA512 验证。
 *
 * @param {string} dbPath - 加密数据库路径
 * @param {object} [options]
 * @param {number} [options.timeoutMs=120000] - PowerShell 超时毫秒
 * @returns {{ key: string|null, error: string|null }}
 */
export function extractTraeKey(dbPath, options = {}) {
  const timeoutMs = options.timeoutMs || 120000;

  if (!isWindows) {
    return { key: null, error: "密钥提取仅支持 Windows 平台" };
  }

  // 读取数据库第一页用于 HMAC 验证
  const page1 = readFirstPage(dbPath);
  if (!page1) {
    return { key: null, error: `无法读取数据库文件: ${dbPath}` };
  }
  const saltHex = page1.subarray(0, 16).toString("hex");

  // 定位 PowerShell 脚本
  const psScript = join(__dirname, "..", "scripts", "extract-trae-key.ps1");
  if (!existsSync(psScript)) {
    return { key: null, error: `PowerShell 脚本未找到: ${psScript}` };
  }

  // PowerShell 只需要盐值，不需要完整页面
  const psCmd = [`& "${psScript}"`, `-SaltHex '${saltHex}'`, `-TimeoutSeconds ${Math.ceil(timeoutMs / 1000)}`].join(
    " ",
  );

  try {
    const stdout = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psCmd], {
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });

    // 解析 JSON 输出（取最后一行）
    const lines = stdout
      .trim()
      .split("\n")
      .filter((l) => l.trim());
    const jsonLine = lines[lines.length - 1];
    const result = JSON.parse(jsonLine);

    if (!result.success) {
      return { key: null, error: result.error || "未知错误" };
    }

    const candidates = result.candidates || [];
    if (candidates.length === 0) {
      return { key: null, error: "Trae 进程内存中未找到匹配盐值的密钥候选" };
    }

    // 用 Node.js crypto 逐一验证候选密钥
    for (const candidateHex of candidates) {
      const keyBuf = Buffer.from(candidateHex, "hex");
      if (keyBuf.length === 32 && verifyEncKey(keyBuf, page1)) {
        return { key: candidateHex, error: null };
      }
    }

    return { key: null, error: `找到 ${candidates.length} 个候选，但 HMAC 验证均未通过` };
  } catch (err) {
    if (err.code === "ENOENT") {
      return { key: null, error: "PowerShell 未找到，请确保 Windows PowerShell 可用" };
    }
    if (err.killed || err.code === "ETIMEDOUT") {
      return { key: null, error: `密钥提取超时（${timeoutMs}ms）` };
    }
    const stderr = err.stderr || "";
    return { key: null, error: stderr ? stderr.trim() : err.message };
  }
}
