const { EmbedBuilder } = require("discord.js");

// =====================
// SETTINGS
// =====================
const STAFF_ROLE_ID = "1462447685448630332";
const COMMAND = "!notreact";
const TARGET_EMOJI = "❤️";

// =====================
// REGISTER
// =====================
function registerNotReact(client) {
  client.on("messageCreate", async (message) => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;

      // רק סטאף
      if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return;

      const args = message.content.trim().split(/\s+/);
      if (args[0] !== COMMAND) return;

      const channelId = args[1];
      const messageId = args[2];

      if (!channelId || !messageId) {
        return message.reply("❌ שימוש: `!notreact CHANNEL_ID MESSAGE_ID`");
      }

      const targetChannel = await message.guild.channels.fetch(channelId).catch(() => null);
      if (!targetChannel) return message.reply("❌ לא מצאתי את החדר עם ה־ID הזה.");

      const targetMessage = await targetChannel.messages.fetch(messageId).catch(() => null);
      if (!targetMessage) return message.reply("❌ לא מצאתי את ההודעה עם ה־ID הזה.");

      // מביא את כל הסטאף
      const members = await message.guild.members.fetch().catch(() => null);
      if (!members) return message.reply("❌ לא הצלחתי להביא את כל המשתמשים.");

      const staffMembers = members.filter(
        (m) => !m.user.bot && m.roles.cache.has(STAFF_ROLE_ID)
      );

      // מי עשה ❤️
      const reaction = targetMessage.reactions.cache.find((r) => r.emoji.name === TARGET_EMOJI);

      const reactedIds = new Set();

      if (reaction) {
        const users = await reaction.users.fetch().catch(() => null);
        if (users) {
          users.forEach((u) => {
            if (!u.bot) reactedIds.add(u.id);
          });
        }
      }

      // מי מהסטאף לא עשה ❤️
      const notReacted = staffMembers
        .filter((m) => !reactedIds.has(m.id))
        .map((m) => `<@${m.id}>`);

      const embed = new EmbedBuilder()
        .setTitle("📌 Staff Not Reacted")
        .setColor(0x00aaff)
        .setDescription(
          `📍 חדר: <#${channelId}>\n` +
            `🧾 הודעה ID: \`${messageId}\`\n` +
            `❤️ ריאקשן נדרש: **${TARGET_EMOJI}**\n\n` +
            `👮 כמות סטאף: **${staffMembers.size}**\n` +
            `✅ עשו ריאקשן: **${reactedIds.size}**\n` +
            `❌ לא עשו: **${notReacted.length}**\n\n` +
            "━━━━━━━━━━━━━━━━━━━━\n" +
            (notReacted.length > 0 ? notReacted.join("\n") : "🔥 כולם עשו ריאקשן!")
        )
        .setFooter({ text: "Frogixx • NotReaction System" })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } catch (err) {
      console.log("❌ NotReact error:", err);
      return message.reply("❌ הייתה שגיאה. תבדוק בטרמינל.");
    }
  });
}

module.exports = { registerNotReact };
