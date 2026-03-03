const { EmbedBuilder, ChannelType } = require("discord.js");

// =====================
// SETTINGS
// =====================
const STAFF_ROLE_ID = "1462447685448630332"; // תחליף אם צריך
const COMMAND = "!notvoice";

// =====================
// REGISTER
// =====================
function registerNotVoice(client) {
  client.on("messageCreate", async (message) => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;

      // רק סטאף יכול
      if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return;

      const args = message.content.trim().split(/\s+/);
      if (args[0] !== COMMAND) return;

      const voiceId = args[1];
      if (!voiceId) {
        return message.reply("❌ שימוש: `!notvoice VOICE_CHANNEL_ID`");
      }

      const voiceChannel = await message.guild.channels.fetch(voiceId).catch(() => null);

      if (
        !voiceChannel ||
        (voiceChannel.type !== ChannelType.GuildVoice &&
          voiceChannel.type !== ChannelType.GuildStageVoice)
      ) {
        return message.reply("❌ לא מצאתי שיחה עם ה־ID הזה.");
      }

      // מביא את כל הסטאף
      const members = await message.guild.members.fetch().catch(() => null);
      if (!members) return message.reply("❌ לא הצלחתי להביא את כל המשתמשים.");

      const staffMembers = members.filter(
        (m) => !m.user.bot && m.roles.cache.has(STAFF_ROLE_ID)
      );

      // מי בשיחה?
      const inVoice = new Set(voiceChannel.members.map((m) => m.id));

      // מי לא בשיחה
      const notInVoice = staffMembers
        .filter((m) => !inVoice.has(m.id))
        .map((m) => `<@${m.id}>`);

      const embed = new EmbedBuilder()
        .setTitle("📢 Staff Not In Voice")
        .setColor(0xff0000)
        .setDescription(
          `🎧 שיחה: **${voiceChannel.name}**\n` +
            `👮 כמות סטאף: **${staffMembers.size}**\n` +
            `🟢 נמצאים בשיחה: **${voiceChannel.members.size}**\n` +
            `🔴 לא בשיחה: **${notInVoice.length}**\n\n` +
            "━━━━━━━━━━━━━━━━━━━━\n" +
            (notInVoice.length > 0
              ? notInVoice.join("\n")
              : "✅ כולם בשיחה! 🔥")
        )
        .setFooter({ text: "Frogixx • NotVoice System" })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } catch (err) {
      console.log("❌ NotVoice error:", err);
    }
  });
}

module.exports = { registerNotVoice };
