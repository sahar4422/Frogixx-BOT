const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

// =====================
// YOUR SETTINGS
// =====================
const GUILD_ID = "1461671595075436728";

const STAFF_ROLE_ID = "1462447685448630332";
const TOP_CHANNEL_ID = "1470764648201584763";

const AFK_CHANNEL_ID = "1466491883642556569";

const FILE_PATH = path.join(__dirname, "staff_voice_time.json");

// Every minute: add time + update embed
const TICK_INTERVAL_MS = 60 * 1000;

// =====================
// SECRET COMMANDS (STAFF ONLY)
// =====================
const SECRET_RESET = "!frogresetstaffvoice";
const SECRET_ADD = "!frogaddvoice"; // !frogaddvoice @user 120 (minutes)
const SECRET_REMOVE = "!frogremovevoice"; // !frogremovevoice @user 120 (minutes)
const SECRET_CHECK = "!frogcheckvoice"; // !frogcheckvoice @user

// =====================
// JSON HELPERS
// =====================
function readJsonSafe() {
  try {
    if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, JSON.stringify({}, null, 2));
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    if (!raw || raw.trim() === "") return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeJsonSafe(data) {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
  } catch {}
}

// =====================
// TIME FORMAT (ENGLISH)
// =====================
function formatSecondsEnglish(seconds) {
  const total = Math.max(0, Math.floor(seconds));

  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// =====================
// CHECKS
// =====================
function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE_ID);
}

function isValidVoiceChannelId(channelId) {
  if (!channelId) return false;
  if (channelId === AFK_CHANNEL_ID) return false;
  return true;
}

// =====================
// GLOBALS
// =====================
let data = readJsonSafe(); // { userId: seconds }
let lastTopMessageId = null;

// staff currently in voice (NOT AFK)
const activeInVoice = new Map();
// userId -> { lastTick: timestampMs }

// =====================
// ADD TIME
// =====================
function addSeconds(userId, secondsToAdd) {
  if (!userId) return;
  if (!secondsToAdd || secondsToAdd <= 0) return;

  data = readJsonSafe();

  if (!data[userId]) data[userId] = 0;
  data[userId] = Number(data[userId]) + secondsToAdd;

  writeJsonSafe(data);
}

// =====================
// BUILD EMBED (TOP + ALL STAFF)
// =====================
async function buildTopEmbed(guild) {
  data = readJsonSafe();

  // fetch all members
  const members = await guild.members.fetch().catch(() => null);
  if (!members) return null;

  const staffMembers = members.filter((m) => !m.user.bot && isStaff(m));

  // build list of ALL staff even if 0
  const arr = [];
  for (const member of staffMembers.values()) {
    const seconds = Number(data[member.id]) || 0;
    arr.push({ userId: member.id, seconds });
  }

  // sort
  arr.sort((a, b) => b.seconds - a.seconds);

const top10 = arr;

  const embed = new EmbedBuilder()
    .setColor(0xffcc00)
    .setTitle("🎧 Staff Voice Top (Live)")
    .setDescription(
      "📌 מתעדכן כל ** דקה **\n" +
        "🚫 בשיחת AFK הזמן לא נחשב\n" +
        "👮 הטבלה היא רק של ** צוות **\n\n" +
        "━━━━━━━━━━━━━━━━━━━━"
    )
    .setFooter({ text: "Frogixx • Staff Voice Tracker" })
    .setTimestamp();

  // TOP 10
  let topText = "";
  for (let i = 0; i < top10.length; i++) {
    const u = top10[i];
    const place = i + 1;

    const icon =
      place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : "🔸";

    topText += `${icon} **#${place}** <@${u.userId}> — **${formatSecondsEnglish(
      u.seconds
    )}**\n`;
  }

embed.addFields({ name: "🏆 Staff Top (All)", value: topText || "No staff found." });

  // LIVE STAFF
  const liveStaff = [...activeInVoice.keys()];
  if (liveStaff.length > 0) {
    const show = liveStaff.slice(0, 20).map((id) => `<@${id}>`).join(" • ");
    embed.addFields({
      name: "🟢 Live Staff in Voice",
      value: show,
    });
  } else {
    embed.addFields({
      name: "🟢 Live Staff in Voice",
      value: "No staff members are in voice right now.",
    });
  }

  // STAFF COUNT
  embed.addFields({
    name: "👮 Total Staff Members",
    value: `${staffMembers.size}`,
    inline: true,
  });

  return embed;
}

// =====================
// UPDATE TOP MESSAGE
// =====================
async function updateTopMessage(client) {
  const channel = await client.channels.fetch(TOP_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const embed = await buildTopEmbed(channel.guild);
  if (!embed) return;

  // find existing message if we don't have it
  if (!lastTopMessageId) {
    const messages = await channel.messages.fetch({ limit: 15 }).catch(() => null);
    if (messages) {
      const existing = messages.find(
        (m) =>
          m.author?.id === client.user.id &&
          m.embeds?.[0]?.title?.includes("Staff Voice Top")
      );
      if (existing) lastTopMessageId = existing.id;
    }
  }

  // edit existing
  if (lastTopMessageId) {
    const msg = await channel.messages.fetch(lastTopMessageId).catch(() => null);

    // if deleted -> reset and send new
    if (!msg) {
      lastTopMessageId = null;
    } else {
      await msg.edit({ embeds: [embed] }).catch(() => {});
      return;
    }
  }

  // send new
  const sent = await channel.send({ embeds: [embed] }).catch(() => null);
  if (sent) lastTopMessageId = sent.id;
}

// =====================
// EVERY MINUTE TICK
// =====================
async function minuteTick(client) {
  try {
    // Adds +60 seconds for everyone currently in voice (not AFK)
    for (const [userId, info] of activeInVoice.entries()) {
      const now = Date.now();
      const diffSeconds = Math.floor((now - info.lastTick) / 1000);

      if (diffSeconds >= 30) {
        addSeconds(userId, 60);
        activeInVoice.set(userId, { lastTick: now });
      }
    }

    await updateTopMessage(client);
  } catch {}
}

// =====================
// VOICE TRACKING
// =====================
async function handleVoice(oldState, newState) {
  try {
    const member = newState.member || oldState.member;
    if (!member) return;
    if (member.user.bot) return;

    // only staff
    if (!isStaff(member)) {
      activeInVoice.delete(member.id);
      return;
    }

    const userId = member.id;

    const oldId = oldState.channelId;
    const newId = newState.channelId;

    const oldValid = isValidVoiceChannelId(oldId);
    const newValid = isValidVoiceChannelId(newId);

    // joined valid voice
    if (!oldValid && newValid) {
      activeInVoice.set(userId, { lastTick: Date.now() });
      return;
    }

    // left valid voice
    if (oldValid && !newValid) {
      activeInVoice.delete(userId);
      return;
    }

    // moved
    if (oldId !== newId) {
      // moved into AFK
      if (newId === AFK_CHANNEL_ID) {
        activeInVoice.delete(userId);
        return;
      }

      // moved from AFK into valid voice
      if (oldId === AFK_CHANNEL_ID && newValid) {
        activeInVoice.set(userId, { lastTick: Date.now() });
        return;
      }

      // moved between valid voices - keep tracking
      if (oldValid && newValid) return;
    }
  } catch {}
}

// =====================
// SCAN ACTIVE VOICE ON START / AFTER RESET
// =====================
async function scanWhoIsInVoice(client) {
  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;

    const members = await guild.members.fetch().catch(() => null);
    if (!members) return;

    members.forEach((member) => {
      if (member.user.bot) return;
      if (!isStaff(member)) return;

      const vc = member.voice.channelId;

      if (vc && vc !== AFK_CHANNEL_ID) {
        activeInVoice.set(member.id, { lastTick: Date.now() });
      }
    });
  } catch {}
}

// =====================
// SECRET COMMANDS
// =====================
async function handleSecretCommands(client, message) {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    // staff only
    if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return;

    const args = message.content.trim().split(/\s+/);
    const cmd = args[0];

    // RESET
    if (cmd === SECRET_RESET) {
      writeJsonSafe({});
      data = {};

      // חשוב: לא מנקים לגמרי, אלא עושים סריקה מחדש
      activeInVoice.clear();
      await scanWhoIsInVoice(client);

      await message.reply("✅ Staff voice time has been reset!");
      await updateTopMessage(client);
      return;
    }

    // CHECK
    if (cmd === SECRET_CHECK) {
      const user = message.mentions.users.first();
      if (!user) return message.reply("❌ Usage: `!frogcheckvoice @user`");

      data = readJsonSafe();
      const seconds = Number(data[user.id]) || 0;

      return message.reply(`🎧 <@${user.id}> has: **${formatSecondsEnglish(seconds)}**`);
    }

    // ADD
    if (cmd === SECRET_ADD) {
      const user = message.mentions.users.first();
      const minutes = Number(args[2]);

      if (!user || !minutes || minutes <= 0) {
        return message.reply("❌ Usage: `!frogaddvoice @user 120` (minutes)");
      }

      addSeconds(user.id, Math.floor(minutes * 60));
      await message.reply(`✅ Added **${minutes} minutes** to <@${user.id}> 🎧`);
      await updateTopMessage(client);
      return;
    }

    // REMOVE
    if (cmd === SECRET_REMOVE) {
      const user = message.mentions.users.first();
      const minutes = Number(args[2]);

      if (!user || !minutes || minutes <= 0) {
        return message.reply("❌ Usage: `!frogremovevoice @user 120` (minutes)");
      }

      data = readJsonSafe();

      const removeSeconds = Math.floor(minutes * 60);
      const current = Number(data[user.id]) || 0;

      data[user.id] = Math.max(0, current - removeSeconds);
      writeJsonSafe(data);

      await message.reply(`✅ Removed **${minutes} minutes** from <@${user.id}> 🎧`);
      await updateTopMessage(client);
      return;
    }
  } catch {}
}

// =====================
// REGISTER
// =====================
function registerStaffVoiceTop(client) {
  client.once("ready", async () => {
    console.log("✅ Staff Voice Top LIVE loaded!");

    // scan who is already in voice
    await scanWhoIsInVoice(client);

    // update first time
    await updateTopMessage(client);

    // every minute: add time + update
    setInterval(() => minuteTick(client), TICK_INTERVAL_MS);
  });

  client.on("voiceStateUpdate", async (oldState, newState) => {
    await handleVoice(oldState, newState);
  });

  client.on("messageCreate", async (message) => {
    await handleSecretCommands(client, message);
  });
}

module.exports = { registerStaffVoiceTop };
