/**
 * SQLCipher 4 加密原语 — 用于解密 Trae 数据库。
 *
 * 移植自 trae-db-decrypt (https://github.com/Oh-My-Trae/trae-db-decrypt)
 * 原始方法参考 wechat-decrypt: https://github.com/ylytdeng/wechat-decrypt
 *
 * SQLCipher 4 参数:
 *   算法: AES-256-CBC
 *   密钥派生: PBKDF2-HMAC-SHA512, 2 轮迭代
 *   HMAC: HMAC-SHA512
 *   页面大小: 4096 bytes
 *   保留区: 80 bytes (IV=16 + HMAC=64)
 */

import { createDecipheriv, pbkdf2Sync, createHmac, timingSafeEqual } from "node:crypto";
import { mkdtempSync, openSync, readSync, closeSync, statSync, writeSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const PAGE_SZ = 4096;
export const KEY_SZ = 32;
export const SALT_SZ = 16;
export const IV_SZ = 16;
export const HMAC_SZ = 64;
export const RESERVE_SZ = 80; // IV_SZ + HMAC_SZ
export const SQLITE_HDR = Buffer.from("SQLite format 3\0", "ascii");

/**
 * 从加密数据库文件读取第一页（前 4096 字节）。
 * @param {string} dbPath
 * @returns {Buffer|null}
 */
export function readFirstPage(dbPath) {
  try {
    const fd = openSync(dbPath, "r");
    const buf = Buffer.alloc(PAGE_SZ);
    readSync(fd, buf, 0, PAGE_SZ, 0);
    closeSync(fd);
    return buf;
  } catch {
    return null;
  }
}

/**
 * 派生 HMAC 验证用的 MAC 密钥。
 * 将 salt 每个字节与 0x3A 异或，再用 PBKDF2-SHA512 派生。
 * @param {Buffer} encKey - 32 字节原始加密密钥
 * @param {Buffer} salt - 16 字节 salt
 * @returns {Buffer} 32 字节 MAC 密钥
 */
export function deriveMacKey(encKey, salt) {
  const macSalt = Buffer.alloc(SALT_SZ);
  for (let i = 0; i < SALT_SZ; i++) macSalt[i] = salt[i] ^ 0x3a;
  return pbkdf2Sync(encKey, macSalt, 2, KEY_SZ, "sha512");
}

/**
 * 验证加密密钥是否正确。
 * 使用 HMAC-SHA512 校验数据库第一页的完整性标志。
 *
 * @param {Buffer} encKey - 32 字节密钥
 * @param {Buffer} dbPage1 - 数据库第一页 (4096 字节)
 * @returns {boolean}
 */
export function verifyEncKey(encKey, dbPage1) {
  try {
    if (dbPage1.length < PAGE_SZ) return false;

    const salt = dbPage1.subarray(0, SALT_SZ);
    const macKey = deriveMacKey(encKey, salt);

    // HMAC 覆盖: encrypted_data + IV + page_number
    const hmacData = dbPage1.subarray(SALT_SZ, PAGE_SZ - RESERVE_SZ + IV_SZ);
    const storedHmac = dbPage1.subarray(PAGE_SZ - HMAC_SZ, PAGE_SZ);

    const hmac = createHmac("sha512", macKey);
    hmac.update(hmacData);
    const pgno = Buffer.alloc(4);
    pgno.writeUInt32LE(1);
    hmac.update(pgno);

    return timingSafeEqual(hmac.digest(), storedHmac);
  } catch {
    return false;
  }
}

/**
 * 解密单个 SQLCipher 4 页面。
 *
 * @param {Buffer} encKey - 32 字节密钥
 * @param {Buffer} pageData - 加密的页面数据
 * @param {number} pgno - 页码 (从 1 开始)
 * @returns {Buffer} 解密后的 4096 字节页面
 */
export function decryptPage(encKey, pageData, pgno) {
  if (pageData.length < PAGE_SZ) {
    // 补齐到完整页面大小（最后一页可能不完整）
    const padded = Buffer.alloc(PAGE_SZ);
    pageData.copy(padded);
    pageData = padded;
  }

  const iv = pageData.subarray(PAGE_SZ - RESERVE_SZ, PAGE_SZ - RESERVE_SZ + IV_SZ);
  const decipher = createDecipheriv("aes-256-cbc", encKey, iv);
  decipher.setAutoPadding(false); // SQLCipher 不使用 PKCS#7 填充

  if (pgno === 1) {
    // 第一页的前 16 字节是 salt（代替 SQLite header）
    const encrypted = pageData.subarray(SALT_SZ, PAGE_SZ - RESERVE_SZ);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return Buffer.concat([SQLITE_HDR, decrypted, Buffer.alloc(RESERVE_SZ)]);
  }

  const encrypted = pageData.subarray(0, PAGE_SZ - RESERVE_SZ);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return Buffer.concat([decrypted, Buffer.alloc(RESERVE_SZ)]);
}

/**
 * 将加密数据库解密为可读的 SQLite 文件。
 *
 * @param {Buffer} encKey - 32 字节密钥
 * @param {string} dbPath - 加密数据库路径
 * @returns {string} 解密后的临时文件路径
 */
export function decryptDatabase(encKey, dbPath) {
  const stats = statSync(dbPath);
  const totalPages = Math.ceil(stats.size / PAGE_SZ) || 1;

  const tmpDir = mkdtempSync(join(tmpdir(), "ocusage-trae-"));
  const outPath = join(tmpDir, "decrypted.db");

  const fdIn = openSync(dbPath, "r");
  const fdOut = openSync(outPath, "w");

  const pageBuf = Buffer.alloc(PAGE_SZ);

  try {
    for (let pgno = 1; pgno <= totalPages; pgno++) {
      const bytesRead = readSync(fdIn, pageBuf, 0, PAGE_SZ, (pgno - 1) * PAGE_SZ);
      if (bytesRead === 0) break;

      const inputPage = bytesRead < PAGE_SZ ? pageBuf.subarray(0, bytesRead) : pageBuf;
      const decrypted = decryptPage(encKey, inputPage, pgno);
      writeSync(fdOut, decrypted);
    }
  } finally {
    closeSync(fdIn);
    closeSync(fdOut);
  }

  return outPath;
}

/**
 * 清理解密产生的临时文件。
 * @param {string} decryptedPath - decryptDatabase 返回的路径
 */
export function cleanupDecrypted(decryptedPath) {
  if (!decryptedPath) return;
  try {
    unlinkSync(decryptedPath);
    rmdirSync(dirname(decryptedPath));
  } catch {
    // 清理失败不影响主流程
  }
}
