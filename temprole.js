const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

// =====================
// SETTINGS
// =====================
const STAFF_ROLE_ID = "1462447685448630332";

// קובץ שמירה
const FILE_PATH = path.join(__dirname, "temp_roles.json");

// פקודות
const CMD_ADD = "!temprole";        // !temprole @user @role 7d
const CMD_REMOVE = "!removetemprole"; // !removetemprole @user @role
const CMD_LIST = "!temproles";      // רשימה

// כל כמה זמן לבדוק ולהוריד רולים שפג תוקפם
const CHECK_INTERVAL_MS = 30 * 1000;

// =====================
// JSON HELPERS
// =====================
function readJsonSafe() {
  try {
    if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, JSON.stringify([], null, 2));
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    if (!raw || raw.trim() === "") return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeJsonSafe(data) {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
  } catch {}
}

// =====================
// TIME PARSER
// =====================
// 10m / 2h / 7d / 1w
function parseDurationToMs(input) {
  if (!input) return null;

  const match = input.toLowerCase().match(/^(\d+)(s|m|h|d|w)$/);
  if (!match) return null;

  const num = Number(match[1]);
  const unit = match[2];

  if (!num || num <= 0) return null;

  const mult =
    unit === "s"
      ? 1000
      : unit === "m"
      ? 60 * 1000
      : unit === "h"
      ? 60 * 60 * 1000
      : unit === "d"
      ? 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;

  return num * mult;
}

function formatMs(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (day > 0) return `${day} ימים`;
  if (hr > 0) return `${hr} שעות`;
  if (min > 0) return `${min} דקות`;
  return `${sec} שניות`;
}

function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE_ID);
}

// =====================
// REMOVE EXPIRED ROLES
// =====================
async function removeExpired(client) {
  try {
    let data = readJsonSafe();
    if (!Array.isArray(data) || data.length === 0) return;

    const now = Date.now();
    const keep = [];

    for (const item of data) {
      const { guildId, userId, roleId, expiresAt } = item;

      if (!guildId || !userId || !roleId || !expiresAt) continue;

      // עדיין לא פג
      if (now < expiresAt) {
        keep.push(item);
        continue;
      }

      // פג תוקף -> מסירים
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue;

      await member.roles.remove(roleId).catch(() => {});
    }

    writeJsonSafe(keep);
  } catch {}
}

// =====================
// REGISTER
// =====================
function registerTempRoleSystem(client) {
  client.once("ready", async () => {
    console.log("✅ TempRole system loaded!");
    setInterval(() => removeExpired(client), CHECK_INTERVAL_MS);
  });

  client.on("messageCreate", async (message) => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;

      const args = message.content.trim().split(/\s+/);
      const cmd = args[0];

      // רק סטאף
      if (![CMD_ADD, CMD_REMOVE, CMD_LIST].includes(cmd)) return;
      if (!isStaff(message.member)) return message.reply("❌ אין לך הרשאה.");

      // =====================
      // LIST
      // =====================
      if (cmd === CMD_LIST) {
        const data = readJsonSafe().filter((x) => x.guildId === message.guild.id);

        if (data.length === 0) {
          return message.reply("📌 אין כרגע רולים זמניים פעילים.");
        }

        const lines = data
          .sort((a, b) => a.expiresAt - b.expiresAt)
          .slice(0, 25)
          .map((x, i) => {
            const left = Math.max(0, x.expiresAt - Date.now());
            return `**${i + 1}.** <@${x.userId}> → <@&${x.roleId}> (נשאר: **${formatMs(left)}**)`;
          });

        const embed = new EmbedBuilder()
          .setTitle("⏳ רשימת רולים זמניים")
          .setDescription(lines.join("\n"))
          .setColor(0x00ff99)
          .setFooter({ text: "Frogixx • Temp Roles" })
          .setTimestamp();

        return message.reply({ embeds: [embed] });
      }

      // =====================
      // ADD
      // =====================
      if (cmd === CMD_ADD) {
        const user = message.mentions.users.first();
        const role = message.mentions.roles.first();
        const durationStr = args[3]; // !temprole @user @role 7d

        if (!user || !role || !durationStr) {
          return message.reply("❌ שימוש: `!temprole @user @role 7d`");
        }

        const ms = parseDurationToMs(durationStr);
        if (!ms) {
          return message.reply("❌ זמן לא תקין. דוגמאות: `10m` / `2h` / `7d` / `1w`");
        }

        const member = await message.guild.members.fetch(user.id).catch(() => null);
        if (!member) return message.reply("❌ לא מצאתי את המשתמש.");

        await member.roles.add(role.id).catch(() => null);

        let data = readJsonSafe();
        if (!Array.isArray(data)) data = [];

        // מוחק ישן אם כבר היה אותו רול זמני
        data = data.filter(
          (x) =>
            !(
              x.guildId === message.guild.id &&
              x.userId === user.id &&
              x.roleId === role.id
            )
        );

        data.push({
          guildId: message.guild.id,
          userId: user.id,
          roleId: role.id,
          expiresAt: Date.now() + ms,
        });

        writeJsonSafe(data);

        return message.reply(
          `✅ נתתי ל־${user} את הרול ${role} ל־**${durationStr}** (זמני).`
        );
      }

      // =====================
      // REMOVE MANUAL
      // =====================
      if (cmd === CMD_REMOVE) {
        const user = message.mentions.users.first();
        const role = message.mentions.roles.first();

        if (!user || !role) {
          return message.reply("❌ שימוש: `!removetemprole @user @role`");
        }

        const member = await message.guild.members.fetch(user.id).catch(() => null);
        if (member) await member.roles.remove(role.id).catch(() => {});

        let data = readJsonSafe();
        data = data.filter(
          (x) =>
            !(
              x.guildId === message.guild.id &&
              x.userId === user.id &&
              x.roleId === role.id
            )
        );

        writeJsonSafe(data);

        return message.reply(`🗑️ הסרתי ל־${user} את הרול ${role} (וגם מהרשימה הזמנית).`);
      }
    } catch (err) {
      console.log("❌ TempRole error:", err);
    }
  });
}

module.exports = { registerTempRoleSystem };
