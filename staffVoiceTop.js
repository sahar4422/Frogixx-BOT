const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

// =====================
// SETTINGS
// =====================

const GUILD_ID = "1461671595075436728";
const STAFF_ROLE_ID = "1462447685448630332";

const TOP_CHANNEL_ID = "1470764648201584763";
const AFK_CHANNEL_ID = "1466491883642556569";

const FILE_PATH = path.join(__dirname, "staff_voice_time.json");

const TICK_INTERVAL_MS = 60 * 1000;

// =====================
// COMMANDS
// =====================

const SECRET_RESET = "!frogresetstaffvoice";
const SECRET_CHECK = "!frogcheckvoice";
const SECRET_ADD = "!frogaddvoice";
const SECRET_REMOVE = "!frogremovevoice";

// =====================
// JSON
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
// TIME FORMAT
// =====================

function formatSeconds(seconds) {

  const total = Math.floor(seconds);

  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// =====================

function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE_ID);
}

function validVoice(channelId) {
  if (!channelId) return false;
  if (channelId === AFK_CHANNEL_ID) return false;
  return true;
}

// =====================

let data = readJsonSafe();

const activeVoice = new Map();

let lastMessageId = null;

// =====================
// ADD TIME
// =====================

function addSeconds(userId, seconds) {

  data = readJsonSafe();

  if (!data[userId]) data[userId] = 0;

  data[userId] += seconds;

  writeJsonSafe(data);

}

// =====================
// EMBED
// =====================

async function buildEmbed(guild) {

  data = readJsonSafe();

  const members = await guild.members.fetch();

  const staffMembers = members.filter(m => !m.user.bot && isStaff(m));

  const arr = [];

  staffMembers.forEach(member => {

    const seconds = data[member.id] || 0;

    arr.push({
      id: member.id,
      seconds
    });

  });

  arr.sort((a,b)=>b.seconds-a.seconds);

  const embed = new EmbedBuilder()

  .setColor("#f1c40f")

  .setTitle("🎧 Staff Voice Activity")

  .setDescription(
    "📊 **Live Staff Voice Leaderboard**\n\n" +
    "⏱ מתעדכן כל דקה\n" +
    "🚫 AFK לא נספר\n\n" +
    "━━━━━━━━━━━━━━━━━━━━"
  )

  .setFooter({ text:"Frogixx Staff System" })

  .setTimestamp();

  let leaderboard = "";

  arr.forEach((u,i)=>{

    const place = i+1;

    const icon =
      place===1?"🥇":
      place===2?"🥈":
      place===3?"🥉":"🔹";

    leaderboard +=
      `${icon} **#${place}** <@${u.id}> — **${formatSeconds(u.seconds)}**\n`;

  });

  embed.addFields({
    name:"🏆 Staff Leaderboard",
    value: leaderboard || "No data yet."
  });

  // =====================
  // LIVE STAFF
  // =====================

  const live = [...activeVoice.keys()];

  if (live.length > 0) {

    const liveText = live
      .map(id=>`🟢 <@${id}>`)
      .join("\n");

    embed.addFields({
      name:"🎙 Staff Currently In Voice",
      value: liveText
    });

  } else {

    embed.addFields({
      name:"🎙 Staff Currently In Voice",
      value:"No staff currently in voice."
    });

  }

  return embed;

}

// =====================
// UPDATE MESSAGE
// =====================

async function updateTopMessage(client) {

  const channel = await client.channels.fetch(TOP_CHANNEL_ID).catch(()=>null);

  if (!channel) return;

  const embed = await buildEmbed(channel.guild);

  if (!lastMessageId) {

    const messages = await channel.messages.fetch({limit:10});

    const existing = messages.find(
      m =>
        m.author.id === client.user.id &&
        m.embeds?.[0]?.title?.includes("Staff Voice Activity")
    );

    if (existing) lastMessageId = existing.id;

  }

  if (lastMessageId) {

    const msg = await channel.messages.fetch(lastMessageId).catch(()=>null);

    if (msg) {

      await msg.edit({embeds:[embed]});

      return;

    }

  }

  const sent = await channel.send({embeds:[embed]});

  lastMessageId = sent.id;

}

// =====================
// EVERY MINUTE
// =====================

async function minuteTick(client) {

  try {

    activeVoice.forEach((v,userId)=>{

      addSeconds(userId,60);

    });

    await updateTopMessage(client);

  } catch {}

}

// =====================
// VOICE TRACKING
// =====================

async function handleVoice(oldState,newState){

  try {

    const member = newState.member || oldState.member;

    if (!member) return;

    if (member.user.bot) return;

    if (!isStaff(member)) return;

    const oldId = oldState.channelId;
    const newId = newState.channelId;

    const oldValid = validVoice(oldId);
    const newValid = validVoice(newId);

    if (!oldValid && newValid) {

      activeVoice.set(member.id,true);

      return;

    }

    if (oldValid && !newValid) {

      activeVoice.delete(member.id);

      return;

    }

  } catch {}

}

// =====================
// RESET SUMMARY
// =====================

function buildSummary(){

  const arr = Object.entries(data).map(([id,seconds])=>({

    id,
    seconds

  }));

  arr.sort((a,b)=>b.seconds-a.seconds);

  const total = arr.reduce((sum,u)=>sum+u.seconds,0);

  const embed = new EmbedBuilder()

  .setColor("#e74c3c")

  .setTitle("📊 Staff Voice Summary Before Reset")

  .setTimestamp();

  if(arr[0])
    embed.addFields({
      name:"🥇 Most Active Staff",
      value:`<@${arr[0].id}> — ${formatSeconds(arr[0].seconds)}`
    });

  if(arr[1])
    embed.addFields({
      name:"🥈 Second Place",
      value:`<@${arr[1].id}> — ${formatSeconds(arr[1].seconds)}`
    });

  if(arr[2])
    embed.addFields({
      name:"🥉 Third Place",
      value:`<@${arr[2].id}> — ${formatSeconds(arr[2].seconds)}`
    });

  embed.addFields({
    name:"📊 Total Staff Voice Time",
    value: formatSeconds(total)
  });

  return embed;

}

// =====================
// COMMANDS
// =====================

async function handleCommands(client,message){

  if(!message.guild) return;

  if(message.author.bot) return;

  if(!message.member.roles.cache.has(STAFF_ROLE_ID)) return;

  const args = message.content.split(" ");

  const cmd = args[0];

  if(cmd===SECRET_RESET){

    const embed = buildSummary();

    await message.channel.send({embeds:[embed]});

    writeJsonSafe({});

    data={};

    activeVoice.clear();

    await message.reply("✅ Staff voice time reset.");

    await updateTopMessage(client);

  }

}

// =====================
// REGISTER
// =====================

function registerStaffVoiceTop(client){

  client.once("ready",async()=>{

    await updateTopMessage(client);

    setInterval(()=>minuteTick(client),TICK_INTERVAL_MS);

  });

  client.on("voiceStateUpdate",async(oldState,newState)=>{

    await handleVoice(oldState,newState);

  });

  client.on("messageCreate",async message=>{

    await handleCommands(client,message);

  });

}

module.exports = { registerStaffVoiceTop };