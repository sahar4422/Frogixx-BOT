const fs = require("fs");
const path = require("path");
const {
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");

// =====================
// SETTINGS
// =====================
const ALLOWED_ROLE_ID = "1467527775182258349";
const BACKUP_FOLDER = path.join(__dirname, "backups");

// פקודות
const CMD_BACKUP = "!backup";
const CMD_LIST = "!backuplist";
const CMD_RESTORE = "!restore";

// =====================
// INIT
// =====================
if (!fs.existsSync(BACKUP_FOLDER)) {
  fs.mkdirSync(BACKUP_FOLDER);
}

// =====================
// HELPERS
// =====================
function isAllowed(member) {
  return member?.roles?.cache?.has(ALLOWED_ROLE_ID);
}

function safeName(name) {
  return (name || "server")
    .toLowerCase()
    .replace(/[^a-z0-9א-ת-_ ]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40);
}

function saveBackupFile(guildName, data) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${safeName(guildName)}_${stamp}.json`;
  const fullPath = path.join(BACKUP_FOLDER, filename);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
  return filename;
}

function listBackups() {
  return fs
    .readdirSync(BACKUP_FOLDER)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();
}

function loadBackup(filename) {
  const fullPath = path.join(BACKUP_FOLDER, filename);
  if (!fs.existsSync(fullPath)) return null;
  const raw = fs.readFileSync(fullPath, "utf8");
  return JSON.parse(raw);
}

function serializeOverwrites(overwrites) {
  // overwrites: Collection
  if (!overwrites) return [];

  return overwrites.map((o) => ({
    id: o.id,
    type: o.type, // 0 role / 1 member
    allow: o.allow?.bitfield?.toString() || "0",
    deny: o.deny?.bitfield?.toString() || "0",
  }));
}

// =====================
// BACKUP CREATION
// =====================
async function createBackup(guild) {
  // fetch everything
  await guild.roles.fetch().catch(() => {});
  await guild.channels.fetch().catch(() => {});

  // ===== Roles =====
  const roles = guild.roles.cache
    .filter((r) => !r.managed) // לא רולים של בוטים
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      hoist: r.hoist,
      mentionable: r.mentionable,
      permissions: r.permissions.bitfield.toString(),
      position: r.position,
      isEveryone: r.id === guild.id,
    }));

  // ===== Channels =====
  const channels = guild.channels.cache
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parentId || null,
      position: c.rawPosition,
      topic: c.topic || null,
      nsfw: !!c.nsfw,
      bitrate: c.bitrate || null,
      userLimit: c.userLimit || null,
      rateLimitPerUser: c.rateLimitPerUser || null,
      overwrites: serializeOverwrites(c.permissionOverwrites?.cache),
    }));

  return {
    meta: {
      guildId: guild.id,
      guildName: guild.name,
      createdAt: Date.now(),
      version: 1,
    },
    roles,
    channels,
  };
}

// =====================
// RESTORE
// =====================
async function restoreBackup(client, guild, backupData, userToNotify) {
  // fetch everything
  await guild.roles.fetch().catch(() => {});
  await guild.channels.fetch().catch(() => {});

  // =====================
  // 1) CREATE ROLES
  // =====================
  // map oldRoleId -> newRoleId
  const roleMap = new Map();

  // everyone role
  roleMap.set(guild.id, guild.id);

  // create roles (skip @everyone)
  const rolesToCreate = backupData.roles
    .filter((r) => !r.isEveryone)
    .sort((a, b) => a.position - b.position);

  for (const r of rolesToCreate) {
    // אם כבר קיים בשם זהה -> נשתמש בו
    let existing = guild.roles.cache.find((x) => x.name === r.name && !x.managed);

    if (!existing) {
      existing = await guild.roles
        .create({
          name: r.name,
          color: r.color,
          hoist: r.hoist,
          mentionable: r.mentionable,
          permissions: new PermissionsBitField(BigInt(r.permissions)),
        })
        .catch(() => null);
    }

    if (existing) {
      roleMap.set(r.id, existing.id);
    }
  }

  // =====================
  // 2) CREATE CATEGORIES FIRST
  // =====================
  const channelMap = new Map(); // oldChannelId -> newChannelId

  const categories = backupData.channels
    .filter((c) => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);

  for (const c of categories) {
    const created = await guild.channels
      .create({
        name: c.name,
        type: ChannelType.GuildCategory,
      })
      .catch(() => null);

    if (created) channelMap.set(c.id, created.id);
  }

  // =====================
  // 3) CREATE OTHER CHANNELS
  // =====================
  const others = backupData.channels
    .filter((c) => c.type !== ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);

  for (const c of others) {
    const parentNewId = c.parentId ? channelMap.get(c.parentId) : null;

    // build overwrites
    const overwrites = (c.overwrites || [])
      .map((o) => {
        const newId = roleMap.get(o.id) || o.id;
        return {
          id: newId,
          type: o.type,
          allow: BigInt(o.allow),
          deny: BigInt(o.deny),
        };
      })
      .filter((x) => !!x.id);

    const payload = {
      name: c.name,
      type: c.type,
      parent: parentNewId,
      topic: c.topic || undefined,
      nsfw: c.nsfw || false,
      rateLimitPerUser: c.rateLimitPerUser || undefined,
      bitrate: c.bitrate || undefined,
      userLimit: c.userLimit || undefined,
      permissionOverwrites: overwrites,
    };

    const created = await guild.channels.create(payload).catch(() => null);
    if (created) channelMap.set(c.id, created.id);
  }

  // =====================
  // DONE
  // =====================
  if (userToNotify) {
    await userToNotify
      .send("✅ השחזור הסתיים! כל המבנה והרולים חזרו.")
      .catch(() => {});
  }
}

// =====================
// REGISTER
// =====================
function registerBackupSystem(client) {
  client.on("messageCreate", async (message) => {
    try {
      // ====== DM ONLY RESTORE ======
      if (!message.guild) {
        if (message.author.bot) return;

        const args = message.content.trim().split(/\s+/);
        const cmd = args[0];

        if (cmd !== CMD_RESTORE) return;

        const filename = args[1];
        if (!filename) {
          return message.reply("❌ שימוש: `!restore backupFile.json`");
        }

        // המשתמש חייב להיות בשרת ולהיות עם רול מורשה
        const guild = client.guilds.cache.first();
        if (!guild) return message.reply("❌ לא מצאתי שרת שהבוט נמצא בו.");

        const member = await guild.members.fetch(message.author.id).catch(() => null);
        if (!member) return message.reply("❌ אתה לא נמצא בשרת.");

        if (!isAllowed(member)) return message.reply("❌ אין לך הרשאה לשחזר גיבוי.");

        const backup = loadBackup(filename);
        if (!backup) return message.reply("❌ לא מצאתי את קובץ הגיבוי הזה.");

        await message.reply("⏳ מתחיל שחזור... זה יכול לקחת כמה דקות.");

        await restoreBackup(client, guild, backup, message.author);

        return;
      }

      // ====== SERVER COMMANDS ======
      if (message.author.bot) return;

      const args = message.content.trim().split(/\s+/);
      const cmd = args[0];

      if (![CMD_BACKUP, CMD_LIST].includes(cmd)) return;

      if (!isAllowed(message.member)) {
        return message.reply("❌ אין לך הרשאה.");
      }

      // LIST
      if (cmd === CMD_LIST) {
        const files = listBackups();
        if (files.length === 0) return message.reply("📌 אין גיבויים עדיין.");

        const show = files.slice(0, 15).map((f) => `• \`${f}\``).join("\n");

        const embed = new EmbedBuilder()
          .setTitle("💾 רשימת גיבויים")
          .setDescription(show)
          .setColor(0x00ff99)
          .setFooter({ text: "Frogixx • Backup System" })
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }

      // BACKUP
      if (cmd === CMD_BACKUP) {
        await message.reply("⏳ יוצר גיבוי...");

        const backup = await createBackup(message.guild);
        const filename = saveBackupFile(message.guild.name, backup);

        const embed = new EmbedBuilder()
          .setTitle("✅ גיבוי נשמר!")
          .setDescription(
            `📌 קובץ: \`${filename}\`\n\n` +
              `📥 לשחזור (רק בפרטי לבוט):\n` +
              `\`${CMD_RESTORE} ${filename}\``
          )
          .setColor(0x00ff99)
          .setFooter({ text: "Frogixx • Backup System" })
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }
    } catch (err) {
      console.log("❌ Backup system error:", err);
    }
  });
}

module.exports = { registerBackupSystem };
