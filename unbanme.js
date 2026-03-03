const { EmbedBuilder } = require("discord.js");

// =====================
// SETTINGS
// =====================
const OWNER_ID = "1226386863770570883"; // רק אתה
const GUILD_ID = "1461671595075436728"; // השרת שלך

const SECRET_UNBAN_CMD = "!frogunban";

// =====================
// REGISTER
// =====================
function registerUnbanMe(client) {
  client.on("messageCreate", async (message) => {
    try {
      // רק DM
      if (message.guild) return;

      // רק אתה
      if (message.author.id !== OWNER_ID) return;

      const content = message.content?.trim();
      if (!content) return;

      if (content !== SECRET_UNBAN_CMD) return;

      const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
      if (!guild) {
        return message.reply("❌ לא מצאתי את השרת (GUILD_ID לא נכון או שהבוט לא שם).");
      }

      // בדיקה אם אתה בבאן
      const bans = await guild.bans.fetch().catch(() => null);
      if (!bans) {
        return message.reply(
          "❌ אין לי הרשאה לראות באנים. תן לבוט Ban Members + View Audit Log."
        );
      }

      const isBanned = bans.has(OWNER_ID);

      if (!isBanned) {
        return message.reply("✅ אתה לא בבאן כרגע בשרת.");
      }

      await guild.members.unban(OWNER_ID, "Frogixx: Owner self-unban via DM").catch(
        () => null
      );

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("✅ הורדתי לך את הבאן!")
        .setDescription("עכשיו אתה יכול להיכנס לשרת מחדש 👑")
        .setFooter({ text: "Frogixx • Unban System" })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } catch (err) {
      console.log("❌ unbanme error:", err);
    }
  });
}

module.exports = { registerUnbanMe };
