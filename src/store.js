import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DATA_DIR } from './config.js';

const DEFAULT_GUILD_CONFIG = {
  staffRoles: [],
  punishChannelId: null,
  censoredWords: [],
  automodLinks: false,
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  const target = path.join(DATA_DIR, file);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, target);
}

export class Store {
  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.config = readJson('config.json', { guilds: {} });
    this.warns = readJson('avisos.json', { guilds: {} });
    this.punishments = readJson('punicoes.json', { items: [] });

    this.config.guilds ??= {};
    this.warns.guilds ??= {};
    this.punishments.items ??= [];
  }

  // ---------- configuração por servidor ----------

  guildConfig(guildId) {
    const saved = this.config.guilds[guildId] || {};
    return {
      ...DEFAULT_GUILD_CONFIG,
      ...saved,
      staffRoles: [...(saved.staffRoles || [])],
      censoredWords: [...(saved.censoredWords || [])],
    };
  }

  updateGuildConfig(guildId, patch) {
    const next = { ...this.guildConfig(guildId), ...patch };
    this.config.guilds[guildId] = next;
    writeJson('config.json', this.config);
    return next;
  }

  addStaffRole(guildId, roleId) {
    const cfg = this.guildConfig(guildId);
    if (cfg.staffRoles.includes(roleId)) return false;
    cfg.staffRoles.push(roleId);
    this.updateGuildConfig(guildId, { staffRoles: cfg.staffRoles });
    return true;
  }

  removeStaffRole(guildId, roleId) {
    const cfg = this.guildConfig(guildId);
    if (!cfg.staffRoles.includes(roleId)) return false;
    this.updateGuildConfig(guildId, { staffRoles: cfg.staffRoles.filter((id) => id !== roleId) });
    return true;
  }

  addCensoredWord(guildId, word) {
    const cfg = this.guildConfig(guildId);
    if (cfg.censoredWords.includes(word)) return false;
    cfg.censoredWords.push(word);
    this.updateGuildConfig(guildId, { censoredWords: cfg.censoredWords });
    return true;
  }

  removeCensoredWord(guildId, word) {
    const cfg = this.guildConfig(guildId);
    if (!cfg.censoredWords.includes(word)) return false;
    this.updateGuildConfig(guildId, {
      censoredWords: cfg.censoredWords.filter((item) => item !== word),
    });
    return true;
  }

  // ---------- avisos ----------

  listWarns(guildId, userId) {
    return this.warns.guilds[guildId]?.[userId] || [];
  }

  countWarns(guildId, userId) {
    return this.listWarns(guildId, userId).length;
  }

  addWarn(guildId, userId, warn) {
    this.warns.guilds[guildId] ??= {};
    this.warns.guilds[guildId][userId] ??= [];
    this.warns.guilds[guildId][userId].push(warn);
    writeJson('avisos.json', this.warns);
    return warn;
  }

  clearWarns(guildId, userId) {
    const guild = this.warns.guilds[guildId];
    if (!guild?.[userId]) return 0;
    const total = guild[userId].length;
    delete guild[userId];
    writeJson('avisos.json', this.warns);
    return total;
  }

  // ---------- punições temporárias ----------

  allPunishments() {
    return this.punishments.items;
  }

  addPunishment(data) {
    const punishment = { ...data, id: randomUUID().slice(0, 8), createdAt: Date.now() };
    this.punishments.items.push(punishment);
    writeJson('punicoes.json', this.punishments);
    return punishment;
  }

  removePunishment(id) {
    const before = this.punishments.items.length;
    this.punishments.items = this.punishments.items.filter((item) => item.id !== id);
    if (this.punishments.items.length !== before) writeJson('punicoes.json', this.punishments);
  }

  clearPunishments(guildId, userId, type) {
    const before = this.punishments.items.length;
    this.punishments.items = this.punishments.items.filter(
      (item) => !(item.guildId === guildId && item.userId === userId && (!type || item.type === type)),
    );
    if (this.punishments.items.length !== before) writeJson('punicoes.json', this.punishments);
    return before - this.punishments.items.length;
  }
}
