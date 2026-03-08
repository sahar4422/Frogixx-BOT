const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

// ===== SETTINGS =====

const GUILD_ID = "1461671595075436728";

const STAFF_ROLE_ID = "1462447685448630332";

const CHANNEL_ID = "1470764648201584763";

const AFK_CHANNEL_ID = "1466491883642556569";

const FILE = path.join(__dirname,"staff_voice_table.json");

const UPDATE_INTERVAL = 60000;

// ===== SECRET COMMANDS =====

const SECRET_RESET = "!frogresetstaffvoice";
const SECRET_ADD = "!frogaddvoice";
const SECRET_REMOVE = "!frogremovevoice";
const SECRET_CHECK = "!frogcheckvoice";

// ===== JSON =====

function read(){

if(!fs.existsSync(FILE)) fs.writeFileSync(FILE,"{}");

return JSON.parse(fs.readFileSync(FILE));

}

function write(data){

fs.writeFileSync(FILE,JSON.stringify(data,null,2));

}

let data = read();

let active = new Map();

let messageId = null;

// ===== TIME FORMAT =====

function format(sec){

const h = Math.floor(sec/3600);

const m = Math.floor((sec%3600)/60);

const s = sec%60;

return `${h}h ${m}m ${s}s`;

}

// ===== SCAN VOICE =====

async function scan(client){

const guild = client.guilds.cache.get(GUILD_ID);

if(!guild) return;

const members = await guild.members.fetch();

members.forEach(member=>{

if(member.user.bot) return;

if(!member.roles.cache.has(STAFF_ROLE_ID)) return;

const vc = member.voice.channelId;

if(vc && vc!==AFK_CHANNEL_ID){

active.set(member.id,Date.now());

}

});

}

// ===== BUILD EMBED =====

async function build(guild){

data = read();

const members = await guild.members.fetch();

const staff = members.filter(m=>m.roles.cache.has(STAFF_ROLE_ID) && !m.user.bot);

const arr = [];

staff.forEach(m=>{

arr.push({

id:m.id,

time:data[m.id]||0

});

});

arr.sort((a,b)=>b.time-a.time);

let table="";

for(let i=0;i<arr.length;i++){

const pos=i+1;

const icon=

pos===1?"🥇":

pos===2?"🥈":

pos===3?"🥉":"🔹";

table+=`${icon} **${pos}.** <@${arr[i].id}> — **${format(arr[i].time)}**\n`;

}

if(!table) table="No data.";

const live=[...active.keys()].map(x=>`<@${x}>`).join(" • ")||"No staff in voice.";

const embed=new EmbedBuilder()

.setColor("#FFD700")

.setTitle("🎧 Staff Voice Activity")

.setDescription(

"📊 Live staff voice tracking\n"+

"⏱ Updates every minute\n"+

"🚫 AFK time ignored\n\n"+

"━━━━━━━━━━━━━━━━━━━━"

)

.addFields(

{ name:"🏆 Staff Ranking", value:table },

{ name:"🟢 Staff In Voice", value:live }

)

.setFooter({text:"Frogixx Staff Voice System"})

.setTimestamp();

return embed;

}

// ===== UPDATE TABLE =====

async function update(client){

const channel = await client.channels.fetch(CHANNEL_ID).catch(()=>null);

if(!channel) return;

const embed = await build(channel.guild);

if(!messageId){

const msgs = await channel.messages.fetch({limit:20});

const existing = msgs.find(m=>m.author.id===client.user.id && m.embeds[0]?.title?.includes("Staff Voice Activity"));

if(existing) messageId=existing.id;

}

if(messageId){

const msg = await channel.messages.fetch(messageId).catch(()=>null);

if(msg){

await msg.edit({embeds:[embed]});

return;

}

}

const sent = await channel.send({embeds:[embed]});

messageId=sent.id;

}

// ===== TICK =====

function tick(){

for(const id of active.keys()){

if(!data[id]) data[id]=0;

data[id]+=60;

}

write(data);

}

// ===== VOICE TRACK =====

function handleVoice(oldState,newState){

const member=newState.member;

if(!member) return;

if(member.user.bot) return;

if(!member.roles.cache.has(STAFF_ROLE_ID)) return;

const vc=newState.channelId;

if(vc && vc!==AFK_CHANNEL_ID){

active.set(member.id,Date.now());

}else{

active.delete(member.id);

}

}

// ===== SECRET COMMANDS =====

async function commands(client,message){

if(!message.guild) return;

if(message.author.bot) return;

if(!message.member.roles.cache.has(STAFF_ROLE_ID)) return;

const args = message.content.split(" ");

const cmd = args[0];

// RESET
if(cmd===SECRET_RESET){

write({});

data={};

active.clear();

await scan(client);

await message.reply("✅ Staff voice reset.");

await update(client);

}

// CHECK
if(cmd===SECRET_CHECK){

const user=message.mentions.users.first();

if(!user) return message.reply("❌ !frogcheckvoice @user");

data=read();

const sec=data[user.id]||0;

message.reply(`🎧 <@${user.id}> has **${format(sec)}**`);

}

// ADD
if(cmd===SECRET_ADD){

const user=message.mentions.users.first();

const minutes=Number(args[2]);

if(!user||!minutes) return message.reply("❌ !frogaddvoice @user 60");

data=read();

if(!data[user.id]) data[user.id]=0;

data[user.id]+=minutes*60;

write(data);

message.reply(`✅ Added ${minutes} minutes to <@${user.id}>`);

await update(client);

}

// REMOVE
if(cmd===SECRET_REMOVE){

const user=message.mentions.users.first();

const minutes=Number(args[2]);

if(!user||!minutes) return message.reply("❌ !frogremovevoice @user 60");

data=read();

if(!data[user.id]) data[user.id]=0;

data[user.id]=Math.max(0,data[user.id]-minutes*60);

write(data);

message.reply(`✅ Removed ${minutes} minutes from <@${user.id}>`);

await update(client);

}

}

// ===== REGISTER =====

function registerStaffVoiceTable(client){

client.once("ready",async()=>{

console.log("✅ Staff Voice Table Loaded");

await scan(client);

await update(client);

setInterval(()=>{

tick();

update(client);

},UPDATE_INTERVAL);

});

client.on("voiceStateUpdate",(o,n)=>handleVoice(o,n));

client.on("messageCreate",(m)=>commands(client,m));

}

module.exports = { registerStaffVoiceTable };