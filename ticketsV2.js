const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

const { createTranscript } = require("discord-html-transcripts");

const SUPPORT_PANEL_ID = "1470136541715103967";
const TICKETS_CATEGORY_ID = "1470412075162534114";
const STAFF_ROLE_ID = "1462447685448630332";
const LOG_CHANNEL_ID = "1470143249720279164";

const intakeSessions = new Map();
const callCooldown = new Map();

const QUESTIONS = {
  general: ["🆘 מה הבעיה שלך?", "📌 מה ניסית כבר?", "📎 יש הוכחות?"],
  bug: ["🐞 מה הבאג?", "🕒 מתי קרה?", "📍 איפה קרה?"],
  staff: ["👮 על מי התלונה?", "📌 מה קרה?", "📎 הוכחות?"],
  base: ["🏠 איזה בייס?", "💰 יש פיקדון?"],
  other: ["📝 מה הנושא?", "📌 תסביר."]
};

function registerTicketSystem(client) {

  // ===== PANEL =====
  client.once("ready", async () => {
    const channel = await client.channels.fetch(SUPPORT_PANEL_ID).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x00c8ff)
      .setTitle("🎫 מערכת טיקטים")
      .setDescription("פתח טיקט והשלים שאלון קצר.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_ticket_general")
        .setLabel("פתח טיקט")
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });
  });

  // ===== BUTTONS =====
  client.on("interactionCreate", async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith("open_ticket_")) {

      const type = interaction.customId.replace("open_ticket_", "");

      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: TICKETS_CATEGORY_ID,
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: STAFF_ROLE_ID, deny: [PermissionFlagsBits.ViewChannel] }
        ]
      });

      intakeSessions.set(channel.id, {
        userId: interaction.user.id,
        type,
        step: 0,
        answers: []
      });

      const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("close_ticket").setLabel("סגור").setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        embeds: [new EmbedBuilder().setColor(0x2f3136).setTitle("🎫 טיקט חדש")],
        components: [controls]
      });

      await channel.send({
        embeds: [new EmbedBuilder().setColor(0x00bfff).setTitle("📝 שאלה 1").setDescription(QUESTIONS[type][0])]
      });

      return interaction.reply({ content: `נפתח: ${channel}`, ephemeral: true });
    }

    // ===== CLOSE =====
    if (interaction.customId === "close_ticket") {

      if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
        return interaction.reply({ content: "❌ רק צוות", ephemeral: true });

      await interaction.reply({ content: "🔒 סוגר בעוד 5 שניות...", ephemeral: true });
      await interaction.channel.send("⚠️ אם מישהו יכתוב הודעה ב־5 שניות הסגירה תבוטל.");

      const filter = msg => !msg.author.bot && msg.author.id !== interaction.user.id;

      const collector = interaction.channel.createMessageCollector({ filter, time: 5000 });

      let canceled = false;

      collector.on("collect", () => {
        canceled = true;
        collector.stop();
      });

      collector.on("end", async () => {

        if (canceled) {
          await interaction.channel.send("❌ הסגירה בוטלה.");
          return;
        }

        const session = intakeSessions.get(interaction.channel.id);
        const openerId = session?.userId;

        const transcript = await createTranscript(interaction.channel);

        // שליחת DM
        if (openerId) {
          const user = await client.users.fetch(openerId).catch(() => null);
          if (user) {
            await user.send({
              content: "📩 הטיקט שלך נסגר.",
              files: [transcript],
            }).catch(() => {});
          }
        }

        const log = await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (log) {
          await log.send({ content: "🔒 טיקט נסגר", files: [transcript] });
        }

        intakeSessions.delete(interaction.channel.id);
        await interaction.channel.delete().catch(() => {});
      });
    }
  });

  // ===== QUESTION FLOW =====
  client.on("messageCreate", async message => {
    if (!message.guild || message.author.bot) return;

    const session = intakeSessions.get(message.channel.id);
    if (!session) return;
    if (message.author.id !== session.userId) return;

    const questions = QUESTIONS[session.type];

    session.answers.push(message.content);
    session.step++;

    if (session.step >= questions.length) {

      await message.channel.permissionOverwrites.edit(STAFF_ROLE_ID, {
        ViewChannel: true,
        SendMessages: true
      });

      await message.channel.send({
        content: `<@&${STAFF_ROLE_ID}>`,
        embeds: [new EmbedBuilder().setColor(0x00ff88).setTitle("📋 סיכום")]
      });

      return;
    }

    await message.channel.send({
      embeds: [new EmbedBuilder().setColor(0x00bfff).setTitle(`📝 שאלה ${session.step + 1}`).setDescription(questions[session.step])]
    });
  });

}

module.exports = { registerTicketSystem };