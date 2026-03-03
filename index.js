require("dotenv").config();

const { Client, GatewayIntentBits, Partials } = require("discord.js");

// =====================
// IMPORT SYSTEMS
// =====================

const { registerTicketSystem } = require("./ticketsV2"); // טיקטים חדשים
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
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
  ],
});

// =====================
// READY
// =====================

client.once("ready", async () => {
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
// LOGIN
// =====================

client.login(process.env.TOKEN); 