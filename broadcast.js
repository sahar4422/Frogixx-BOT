const { EmbedBuilder } = require("discord.js");

// שים כאן את האיידי שלך
const OWNER_ID = "1226386863770570883";

// החדרים שיקבלו את ההודעה
const CHANNELS = [
"1479691568360456326",
"1478782378485878814"
];

function registerBroadcast(client){

client.on("messageCreate", async (message)=>{

if(!message.guild) return;
if(message.author.bot) return;

// רק אתה
if(message.author.id !== OWNER_ID) return;

// פקודה
if(!message.content.startsWith("!broadcast")) return;

const text = message.content.replace("!broadcast","").trim();

if(!text){
return message.reply("❌ שימוש:\n!broadcast ההודעה שלך");
}

const embed = new EmbedBuilder()

.setColor("#5865F2")
.setTitle("📢 הכרזה מהשרת")

.setDescription(text)

.setFooter({text:`נשלח ע\"י ${message.author.tag}`})

.setTimestamp();

for(const id of CHANNELS){

const channel = message.guild.channels.cache.get(id);

if(!channel) continue;

await channel.send({

content:"@everyone",

embeds:[embed],

allowedMentions:{parse:["everyone"]}

}).catch(()=>{});

}

message.reply("✅ ההכרזה נשלחה בהצלחה.");

});

}

module.exports = { registerBroadcast };