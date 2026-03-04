require("dotenv").config();

const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");

// =====================
// IMPORT SYSTEMS
// =====================

const { registerTicketSystem } = require("./ticketsV2");
const { registerGiveawaySystem } = require("./giveaways");
const { registerLogsV2 } = require("./logsV2");
const { registerMiddlemanSystem } = require("./middlemanTickets");
const { registerBackupSystem } = require("./backup");
const { registerClearCommand } = require("./clear");
const { registerStaffVoiceTop } = require("./staffVoiceTop");
const { registerTempRoleSystem } = require("./temprole");
const { registerNotVoice } = require("./notvoice");
const { registerNicknameSystem } = require("./nicknames");

// =====================
// CLIENT
// =====================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ],
});

// =====================
// READY
// =====================

client.once("clientReady", async () => {
  console.log(`✅ הבוט עלה בהצלחה! מחובר בתור: ${client.user.tag}`);
});

// =====================
// REGISTER SYSTEMS
// =====================

registerTicketSystem(client);
registerGiveawaySystem(client);
registerLogsV2(client);
registerBackupSystem(client);
registerMiddlemanSystem(client);
registerClearCommand(client);
registerStaffVoiceTop(client);
registerTempRoleSystem(client);
registerNotVoice(client);
registerNicknameSystem(client);

// =====================
// WELCOME SYSTEM
// =====================

// IDs
const WELCOME_CHANNEL = "1461738240661782590";
const GOODBYE_CHANNEL = "1463405975925948548";
const MEMBER_ROLE = "1461697279676383314";
const LOG_CHANNEL = "1470779822920826880";

// Member Join
client.on("guildMemberAdd", async (member) => {

  try {

    // Auto Role
    await member.roles.add(MEMBER_ROLE);

    // Welcome Embed
    const welcomeEmbed = new EmbedBuilder()
      .setColor("#00ff88")
      .setTitle("🎉 ברוך הבא לשרת!")
      .setDescription(`שלום ${member} 👋\nברוך הבא לשרת **${member.guild.name}**`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL);
    if (welcomeChannel) welcomeChannel.send({ embeds: [welcomeEmbed] });

    // Log Join
    const logEmbed = new EmbedBuilder()
      .setColor("#2f3136")
      .setTitle("📥 Member Joined")
      .setDescription(`${member.user.tag} נכנס לשרת`)
      .setTimestamp();

    const logChannel = member.guild.channels.cache.get(LOG_CHANNEL);
    if (logChannel) logChannel.send({ embeds: [logEmbed] });

  } catch (err) {
    console.log("Welcome error:", err);
  }

});

// Member Leave
client.on("guildMemberRemove", async (member) => {

  try {

    const goodbyeEmbed = new EmbedBuilder()
      .setColor("#ff3d3d")
      .setTitle("👋 להתראות...")
      .setDescription(`${member.user.tag} עזב את השרת`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    const goodbyeChannel = member.guild.channels.cache.get(GOODBYE_CHANNEL);
    if (goodbyeChannel) goodbyeChannel.send({ embeds: [goodbyeEmbed] });

    // Log Leave
    const logEmbed = new EmbedBuilder()
      .setColor("#2f3136")
      .setTitle("📤 Member Left")
      .setDescription(`${member.user.tag} עזב את השרת`)
      .setTimestamp();

    const logChannel = member.guild.channels.cache.get(LOG_CHANNEL);
    if (logChannel) logChannel.send({ embeds: [logEmbed] });

  } catch (err) {
    console.log("Goodbye error:", err);
  }

});

// =====================
// LOGIN
// =====================

client.login(process.env.TOKEN);