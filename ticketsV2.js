const {
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
ChannelType,
PermissionFlagsBits,
EmbedBuilder
} = require("discord.js");

const { createTranscript } = require("discord-html-transcripts");

const SUPPORT_CHANNEL_ID = "1470136541715103967";
const TICKETS_CATEGORY_ID = "1470412075162534114";
const STAFF_ROLE_ID = "1462447685448630332";
const LOG_CHANNEL_ID = "1470143249720279164";
const TABLE_CHANNEL_ID = "1478782378485878814";

const intakeSessions = new Map();
const callCooldown = new Map();
const ticketClaimed = new Map();
const staffStats = new Map();

let ticketCounter = 1;

const QUESTIONS = {
general:[
"🆘 מה הבעיה שלך?",
"📌 מה ניסית כבר לעשות?",
"📎 יש הוכחות / תמונות?"
],
bug:[
"🐞 מה הבאג?",
"🕒 מתי זה קרה?",
"📍 איפה זה קרה?",
"🔁 זה קורה תמיד?"
],
staff:[
"👮 על איזה איש צוות מדובר?",
"📌 מה בדיוק קרה?",
"🕒 מתי זה קרה?",
"📎 יש הוכחות?"
],
base:[
"🏠 איזה בייס תרצה?",
"💰 יש לך פיקדון?",
"📅 מתי תרצה לקבל?"
],
other:[
"📝 מה הנושא?",
"📌 תסביר בפירוט."
]
};

async function updateStaffTable(client){

const guild = client.guilds.cache.first();
const role = guild.roles.cache.get(STAFF_ROLE_ID);

let description = "";

role.members.forEach(member=>{

const count = staffStats.get(member.id) || 0;

description += `👮 ${member.user.tag} — **${count} טיקטים**\n`;

});

const embed = new EmbedBuilder()
.setColor("#00bfff")
.setTitle("📊 סטטיסטיקת צוות טיקטים")
.setDescription(description || "אין נתונים עדיין")
.setFooter({text:"Frogixx Ticket Analytics"})
.setTimestamp();

const channel = await client.channels.fetch(TABLE_CHANNEL_ID);

const messages = await channel.messages.fetch({limit:5});
const existing = messages.find(m=>m.author.id === client.user.id);

if(existing) existing.edit({embeds:[embed]});
else channel.send({embeds:[embed]});

}

function registerTicketSystem(client){

client.once("clientReady",async()=>{

const channel = await client.channels.fetch(SUPPORT_CHANNEL_ID);

const embed = new EmbedBuilder()
.setColor("#00c8ff")
.setTitle("🎫 מערכת טיקטים מתקדמת")
.setDescription(
"ברוכים הבאים למערכת התמיכה.\n\n"+
"📌 פתח טיקט ובצע שאלון קצר\n"+
"👮 הצוות יראה את הטיקט לאחר השאלון\n\n"+
"━━━━━━━━━━━━━━━━━━━━"
)
.setFooter({text:"Frogixx Ticket System"});

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("open_ticket_general")
.setLabel("עזרה כללית")
.setEmoji("🆘")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("open_ticket_bug")
.setLabel("דיווח באג")
.setEmoji("🐞")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("open_ticket_staff")
.setLabel("תלונה על צוות")
.setEmoji("👮")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("open_ticket_base")
.setLabel("הזמנת בייס")
.setEmoji("🏠")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("open_ticket_other")
.setLabel("אחר")
.setEmoji("📝")
.setStyle(ButtonStyle.Secondary)

);

channel.send({embeds:[embed],components:[row]});

updateStaffTable(client);

});

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return;

if(interaction.customId.startsWith("open_ticket_")){

const type = interaction.customId.replace("open_ticket_","");

const existing = interaction.guild.channels.cache.find(c=>c.name.includes(interaction.user.id));

if(existing)
return interaction.reply({content:`❌ כבר יש לך טיקט פתוח ${existing}`,flags:64});

const channel = await interaction.guild.channels.create({

name:`ticket-${ticketCounter}-${interaction.user.id}`,
type:ChannelType.GuildText,
parent:TICKETS_CATEGORY_ID,

permissionOverwrites:[
{ id:interaction.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
{ id:interaction.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]},
{ id:STAFF_ROLE_ID,deny:[PermissionFlagsBits.ViewChannel]}
]

});

ticketCounter++;

const embed = new EmbedBuilder()
.setColor("#2f3136")
.setTitle("🎫 טיקט נפתח")
.setDescription(
`👤 משתמש: <@${interaction.user.id}>\n`+
`📌 סוג טיקט: **${type}**\n\n`+
"אנא ענה על השאלון."
)
.setTimestamp();

const controls = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("claim_ticket")
.setLabel("קח טיקט")
.setEmoji("🧑‍✈️")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("close_ticket")
.setLabel("סגור טיקט")
.setEmoji("🔒")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("member_options")
.setLabel("אפשרויות ממבר")
.setEmoji("⚙️")
.setStyle(ButtonStyle.Secondary)

);

await channel.send({embeds:[embed],components:[controls]});

intakeSessions.set(channel.id,{
userId:interaction.user.id,
type,
step:0,
answers:[]
});

await channel.send({
embeds:[
new EmbedBuilder()
.setColor("#00bfff")
.setTitle("📝 שאלה 1")
.setDescription(QUESTIONS[type][0])
]
});

return interaction.reply({content:`✅ הטיקט נפתח ${channel}`,flags:64});

}

if(interaction.customId === "member_options"){

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("call_staff")
.setLabel("קריאה לצוות")
.setStyle(ButtonStyle.Primary),

new ButtonBuilder()
.setCustomId("request_close")
.setLabel("בקשת סגירה")
.setStyle(ButtonStyle.Danger)

);

return interaction.reply({content:"בחר אפשרות:",components:[row],flags:64});

}

if(interaction.customId === "claim_ticket"){

if(!interaction.member.roles.cache.has(STAFF_ROLE_ID))
return interaction.reply({content:"❌ רק צוות.",flags:64});

if(ticketClaimed.has(interaction.channel.id))
return interaction.reply({content:"❌ הטיקט כבר נלקח.",flags:64});

ticketClaimed.set(interaction.channel.id,interaction.user.id);

const count = staffStats.get(interaction.user.id) || 0;
staffStats.set(interaction.user.id,count+1);

updateStaffTable(interaction.client);

await interaction.channel.send(`🧑‍✈️ הטיקט נלקח על ידי <@${interaction.user.id}>`);

return interaction.reply({content:"✅ לקחת את הטיקט.",flags:64});

}

if(interaction.customId === "close_ticket"){

if(!interaction.member.roles.cache.has(STAFF_ROLE_ID))
return interaction.reply({content:"❌ רק צוות.",flags:64});

await interaction.channel.send("⚠️ במידה ולא תשלח הודעה ב5 שניות הקרובות הטיקט יסגר.");

const collector = interaction.channel.createMessageCollector({time:5000});

let cancel = false;

collector.on("collect",()=>{

cancel = true;
collector.stop();

});

collector.on("end",async()=>{

if(cancel){

interaction.channel.send("❌ הסגירה בוטלה.");
return;

}

const transcript = await createTranscript(interaction.channel);

const log = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);

log.send({
content:`🔒 טיקט נסגר על ידי <@${interaction.user.id}>`,
files:[transcript]
});

interaction.channel.delete();

});

}

});

client.on("messageCreate",async message=>{

if(!message.guild || message.author.bot) return;

if(message.content.startsWith("!add")){

if(!message.member.roles.cache.has(STAFF_ROLE_ID))
return message.reply("❌ רק צוות.");

const args = message.content.split(" ");
const userId = args[1];

if(!userId) return message.reply("❌ שימוש !add USERID");

const member = await message.guild.members.fetch(userId).catch(()=>null);

if(!member) return message.reply("❌ משתמש לא נמצא");

await message.channel.permissionOverwrites.edit(member.id,{
ViewChannel:true,
SendMessages:true
});

message.channel.send(`✅ <@${member.id}> נוסף לטיקט`);

}

const session = intakeSessions.get(message.channel.id);
if(!session) return;
if(message.author.id !== session.userId) return;

const questions = QUESTIONS[session.type];

session.answers.push(message.content);
session.step++;

if(session.step >= questions.length){

await message.channel.permissionOverwrites.edit(STAFF_ROLE_ID,{
ViewChannel:true,
SendMessages:true
});

let summary = "";

for(let i=0;i<questions.length;i++){
summary += `**${questions[i]}**\n${session.answers[i]}\n\n`;
}

await message.channel.send({
content:`<@&${STAFF_ROLE_ID}>`,
embeds:[
new EmbedBuilder()
.setColor("#00ff88")
.setTitle("📋 סיכום הטיקט")
.setDescription(summary.slice(0,3800))
]
});

intakeSessions.delete(message.channel.id);
return;

}

await message.channel.send({
embeds:[
new EmbedBuilder()
.setColor("#00bfff")
.setTitle(`📝 שאלה ${session.step+1}`)
.setDescription(questions[session.step])
]
});

});

}

module.exports = { registerTicketSystem };