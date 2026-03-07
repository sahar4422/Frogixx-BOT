const { 
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
EmbedBuilder
} = require("discord.js");

// =================
// SETTINGS
// =================

const CHANNEL_ID = "1479691568360456326";

const ROLES = {

drops: "1464263624301351155",
server: "1464264380139962519",
competitions: "1477732092874985712",
partners: "1477605139740360735",
leaks: "1464262189761167401",
staff: "1464264817220260046",
shabbat: "1470797542584221816"

};

// =================
// REGISTER
// =================

function registerReactionRoles(client){

client.once("ready", async ()=>{

const channel = await client.channels.fetch(CHANNEL_ID).catch(()=>null);

if(!channel) return;

const embed = new EmbedBuilder()

.setColor("#5865F2")

.setTitle("🎭 בחירת רולים")

.setDescription(

"ברוכים הבאים למערכת הרולים של השרת.\n\n" +

"📌 לחץ על הכפתור כדי לקבל רול.\n" +

"📌 לחיצה נוספת תסיר את הרול.\n\n" +

"━━━━━━━━━━━━━━━━━━━━\n\n" +

"🎁 **עדכוני דרופים / הגרלות**\n" +

"📢 **עדכוני שרת**\n" +

"🏆 **תיוג תחרויות על חיות**\n" +

"🤝 **תיוג שת\"פ**\n" +

"🕵 **תיוג הדלפות**\n" +

"🎁 **מחכה לבחינה לצוות / מידל**\n" +

"🕯 **שומר שבת**\n\n" +

"━━━━━━━━━━━━━━━━━━━━"

)

.setFooter({text:"Frogixx Role System"})

.setTimestamp();

// ROW 1
const row1 = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("role_drops")
.setLabel("דרופים / הגרלות")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("role_server")
.setLabel("עדכוני שרת")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("role_competitions")
.setLabel("תחרויות")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("role_partners")
.setLabel("שת\"פ")
.setStyle(ButtonStyle.Primary)

);

// ROW 2
const row2 = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("role_leaks")
.setLabel("הדלפות")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("role_staff")
.setLabel("בחינה לצוות")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("role_shabbat")
.setLabel("שומר שבת")
.setStyle(ButtonStyle.Primary)

);

await channel.send({

embeds:[embed],
components:[row1,row2]

});

});

// =================
// BUTTON HANDLER
// =================

client.on("interactionCreate", async interaction=>{

if(!interaction.isButton()) return;

const map = {

role_drops: ROLES.drops,
role_server: ROLES.server,
role_competitions: ROLES.competitions,
role_partners: ROLES.partners,
role_leaks: ROLES.leaks,
role_staff: ROLES.staff,
role_shabbat: ROLES.shabbat

};

const roleId = map[interaction.customId];

if(!roleId) return;

const member = interaction.member;

if(member.roles.cache.has(roleId)){

await member.roles.remove(roleId);

const embed = new EmbedBuilder()

.setColor("#ff4444")
.setTitle("❌ הרול הוסר")
.setDescription(`הרול <@&${roleId}> הוסר בהצלחה.`);

return interaction.reply({embeds:[embed],ephemeral:true});

}else{

await member.roles.add(roleId);

const embed = new EmbedBuilder()

.setColor("#00ff88")
.setTitle("✅ הרול נוסף")
.setDescription(`קיבלת את הרול <@&${roleId}> בהצלחה!`);

return interaction.reply({embeds:[embed],ephemeral:true});

}

});

}

module.exports = { registerReactionRoles };