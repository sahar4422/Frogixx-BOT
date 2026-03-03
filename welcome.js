const { EmbedBuilder } = require("discord.js");

const WELCOME_CHANNEL_ID = "1461738240661782590";
const GOODBYE_CHANNEL_ID = "1463405975925948548";

const MEMBER_ROLE_ID = "1461697279676383314";

function registerWelcomeSystem(client) {
  client.on("guildMemberAdd", async (member) => {
    try {
      // נותן רול ממבר אוטומטי
      const role = member.guild.roles.cache.get(MEMBER_ROLE_ID);
      if (role) {
        await member.roles.add(role).catch(() => {});
      }

      const channel = await client.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(0x00ff99)
        .setTitle("🎉 ברוך הבא לשרת!")
        .setDescription(
          `👋 שלום <@${member.id}>!\n\n` +
            `✨ אנחנו שמחים שהצטרפת אלינו.\n` +
            `🎭 קיבלת אוטומטית את רול הממבר!\n\n` +
            `👤 משתמש: **${member.user.tag}**\n` +
            `🆔 ID: **${member.id}**`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: "Frogixx • Welcome System" })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch {}
  });

  client.on("guildMemberRemove", async (member) => {
    try {
      const channel = await client.channels.fetch(GOODBYE_CHANNEL_ID).catch(() => null);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(0xff5555)
        .setTitle("👋 להתראות!")
        .setDescription(
          `😢 <@${member.id}> יצא מהשרת.\n\n` +
            `👤 משתמש: **${member.user.tag}**\n` +
            `🆔 ID: **${member.id}**`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: "Frogixx • Goodbye System" })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch {}
  });

  console.log("✅ Welcome + Goodbye + Auto Member Role loaded!");
}

module.exports = { registerWelcomeSystem };
