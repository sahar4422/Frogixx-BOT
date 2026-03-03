const { PermissionFlagsBits } = require("discord.js");

// =====================
// SETTINGS
// =====================
const STAFF_ROLE_ID = "1462447685448630332";
const COMMAND = "!clear";

function registerClearCommand(client) {
  client.on("messageCreate", async (message) => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;

      const args = message.content.trim().split(/\s+/);
      if (args[0] !== COMMAND) return;

      // רק סטאף
      if (!message.member.roles.cache.has(STAFF_ROLE_ID)) {
        return message.reply("❌ אין לך הרשאה להשתמש בפקודה הזאת.");
      }

      // כמה למחוק
      const amount = Number(args[1]);

      if (!amount || amount < 1 || amount > 100) {
        return message.reply("❌ שימוש: `!clear 10` (1 עד 100)");
      }

      // מוחק גם את ההודעה של הפקודה
      await message.delete().catch(() => {});

      // מוחק הודעות
      const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);

      if (!deleted) return;

      const msg = await message.channel
        .send(`🧹 נמחקו **${deleted.size}** הודעות.`)
        .catch(() => null);

      // מוחק את ההודעה של האישור אחרי 3 שניות
      if (msg) {
        setTimeout(() => msg.delete().catch(() => {}), 3000);
      }
    } catch (err) {
      console.log("❌ Clear error:", err);
    }
  });
}

module.exports = { registerClearCommand };
