const { EmbedBuilder } = require("discord.js");

// IDs
const WELCOME_CHANNEL = "1461738240661782590";
const GOODBYE_CHANNEL = "1463405975925948548";
const MEMBER_ROLE = "1461697279676383314";
const LOG_CHANNEL = "1470779822920826880";

module.exports = (client) => {

client.on("guildMemberAdd", async (member) => {

try {

// נותן רול ממבר
await member.roles.add(MEMBER_ROLE);

// ===== Welcome Embed =====
const welcomeEmbed = new EmbedBuilder()
.setColor("#00ff88")
.setTitle("🎉 ברוך הבא לשרת!")
.setDescription(`שלום ${member} 👋\n\nברוך הבא לשרת **${member.guild.name}**!\nתהנה ותכבד את החוקים.`)
.setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
.setFooter({ text: `User ID: ${member.id}` })
.setTimestamp();

const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL);
if (welcomeChannel) {
welcomeChannel.send({ embeds: [welcomeEmbed] });
}

// ===== Logs =====
const logEmbed = new EmbedBuilder()
.setColor("#2f3136")
.setTitle("📥 Member Joined")
.setDescription(`${member.user.tag} הצטרף לשרת`)
.setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
.setTimestamp();

const logChannel = member.guild.channels.cache.get(LOG_CHANNEL);
if (logChannel) {
logChannel.send({ embeds: [logEmbed] });
}

} catch (err) {
console.log("Welcome system error:", err);
}

});

// ===== Goodbye =====
client.on("guildMemberRemove", async (member) => {

try {

const goodbyeEmbed = new EmbedBuilder()
.setColor("#ff3d3d")
.setTitle("👋 להתראות...")
.setDescription(`**${member.user.tag}** עזב את השרת.`)
.setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
.setTimestamp();

const goodbyeChannel = member.guild.channels.cache.get(GOODBYE_CHANNEL);
if (goodbyeChannel) {
goodbyeChannel.send({ embeds: [goodbyeEmbed] });
}

// Logs
const logEmbed = new EmbedBuilder()
.setColor("#2f3136")
.setTitle("📤 Member Left")
.setDescription(`${member.user.tag} עזב את השרת`)
.setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
.setTimestamp();

const logChannel = member.guild.channels.cache.get(LOG_CHANNEL);
if (logChannel) {
logChannel.send({ embeds: [logEmbed] });
}

} catch (err) {
console.log("Goodbye system error:", err);
}

});

};