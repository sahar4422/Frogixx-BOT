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

const TICK_INTERVAL_MS = 60 * 1000;

// =====================
// SECRET COMMANDS
// =====================
const SECRET_RESET = "!frogresetstaffvoice";
const SECRET_ADD = "!frogaddvoice";
const SECRET_REMOVE = "!frogremovevoice";
const SECRET_CHECK = "!frogcheckvoice";

// =====================
// JSON HELPERS
// =====================
function readJsonSafe() {
  try {
    if (!fs.existsSync(FILE_PATH))
      fs.writeFileSync(FILE_PATH, JSON.stringify({}, null, 2));
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
// FORMAT TIME
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
let data = readJsonSafe();
let lastTopMessageId = null;

const activeInVoice = new Map();

// =====================
// ADD TIME
// =====================
function addSeconds(userId, secondsToAdd) {
  if (!data[userId]) data[userId] = 0;
  data[userId] = Number(data[userId]) + secondsToAdd;
  writeJsonSafe(data);
}

// =====================
// BUILD EMBED
// =====================
async function buildTopEmbed(guild) {
  data = readJsonSafe();

  const members = await guild.members.fetch().catch(() => null);
  if (!members) return null;

  const staffMembers = members.filter((m) => !m.user.bot && isStaff(m));

  const arr = [];
  for (const member of staffMembers.values()) {
    const seconds = Number(data[member.id]) || 0;
    arr.push({ userId: member.id, seconds });
  }

  arr.sort((a, b) => b.seconds - a.seconds);

  const embed = new EmbedBuilder()
    .setColor(0xffcc00)
    .setTitle("🎧 Staff Voice Top (Live)")
    .setDescription(
      "📌 מתעדכן כל **דקה**\n" +
        "🚫 AFK לא נספר\n" +
        "👮 רק צוות\n\n━━━━━━━━━━━━━━━━━━━━"
    )
    .setFooter({ text: "Frogixx • Staff Voice Tracker" })
    .setTimestamp();

  let topText = "";

  for (let i = 0; i < arr.length; i++) {
    const u = arr[i];
    const place = i + 1;

    const icon =
      place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : "🔸";

    topText += `${icon} **#${place}** <@${u.userId}> — **${formatSecondsEnglish(
      u.seconds
    )}**\n`;
  }

  embed.addFields({
    name: "🏆 Staff Top",
    value: topText || "No data yet."
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

  if (!lastTopMessageId) {
    const messages = await channel.messages.fetch({ limit: 10 });
    const existing = messages.find(
      (m) =>
        m.author.id === client.user.id &&
        m.embeds?.[0]?.title?.includes("Staff Voice Top")
    );

    if (existing) lastTopMessageId = existing.id;
  }

  if (lastTopMessageId) {
    const msg = await channel.messages.fetch(lastTopMessageId).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [embed] });
      return;
    }
  }

  const sent = await channel.send({ embeds: [embed] });
  lastTopMessageId = sent.id;
}

// =====================
// EVERY MINUTE
// =====================
async function minuteTick(client) {
  try {
    for (const userId of activeInVoice.keys()) {
      addSeconds(userId, 60);
    }

    await updateTopMessage(client);
  } catch {}
}

// =====================
// VOICE TRACK
// =====================
async function handleVoice(oldState, newState) {
  try {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    if (!isStaff(member)) {
      activeInVoice.delete(member.id);
      return;
    }

    const oldId = oldState.channelId;
    const newId = newState.channelId;

    const oldValid = isValidVoiceChannelId(oldId);
    const newValid = isValidVoiceChannelId(newId);

    if (!oldValid && newValid) {
      activeInVoice.set(member.id, true);
      return;
    }

    if (oldValid && !newValid) {
      activeInVoice.delete(member.id);
      return;
    }

  } catch {}
}

// =====================
// RESET SUMMARY
// =====================
function buildResetSummary() {
  const arr = Object.entries(data).map(([id, seconds]) => ({
    id,
    seconds
  }));

  arr.sort((a, b) => b.seconds - a.seconds);

  const total = arr.reduce((sum, u) => sum + u.seconds, 0);

  const embed = new EmbedBuilder()
    .setColor(0xff4444)
    .setTitle("📊 Staff Voice Summary Before Reset")
    .setTimestamp();

  if (arr[0])
    embed.addFields({
      name: "🥇 Most Active",
      value: `<@${arr[0].id}> — ${formatSecondsEnglish(arr[0].seconds)}`
    });

  if (arr[1])
    embed.addFields({
      name: "🥈 Second Place",
      value: `<@${arr[1].id}> — ${formatSecondsEnglish(arr[1].seconds)}`
    });

  if (arr[2])
    embed.addFields({
      name: "🥉 Third Place",
      value: `<@${arr[2].id}> — ${formatSecondsEnglish(arr[2].seconds)}`
    });

  embed.addFields({
    name: "📊 Total Staff Voice",
    value: formatSecondsEnglish(total)
  });

  return embed;
}

// =====================
// COMMANDS
// =====================
async function handleSecretCommands(client, message) {
  if (!message.guild || message.author.bot) return;
  if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return;

  const args = message.content.split(" ");
  const cmd = args[0];

  if (cmd === SECRET_RESET) {

    const embed = buildResetSummary();
    await message.channel.send({ embeds: [embed] });

    writeJsonSafe({});
    data = {};

    activeInVoice.clear();

    await message.reply("✅ Staff voice time has been reset!");
    await updateTopMessage(client);
  }

  if (cmd === SECRET_CHECK) {
    const user = message.mentions.users.first();
    if (!user) return;

    const seconds = Number(data[user.id]) || 0;

    message.reply(
      `🎧 <@${user.id}> has **${formatSecondsEnglish(seconds)}**`
    );
  }
}

// =====================
// REGISTER
// =====================
function registerStaffVoiceTop(client) {

  client.once("ready", async () => {

    await updateTopMessage(client);

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