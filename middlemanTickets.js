const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

const { createTranscript } = require("discord-html-transcripts");

const MIDDLEMAN_PANEL_ID = "1461697151443665042";
const TICKETS_CATEGORY_ID = "1470412075162534114";
const MIDDLEMAN_ROLE_ID = "1470405079613050951";
const LOG_CHANNEL_ID = "1470143249720279164";

const intakeSessions = new Map();

function registerMiddlemanSystem(client) {

  client.once("ready", async () => {
    const channel = await client.channels.fetch(MIDDLEMAN_PANEL_ID).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0xff9900)
      .setTitle("💼 מערכת מידלמן")
      .setDescription("פתח טיקט מידלמן מאובטח.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_middleman")
        .setLabel("פתח מידלמן")
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });
  });

  client.on("interactionCreate", async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === "open_middleman") {

      const channel = await interaction.guild.channels.create({
        name: `middleman-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: TICKETS_CATEGORY_ID,
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: MIDDLEMAN_ROLE_ID, deny: [PermissionFlagsBits.ViewChannel] }
        ]
      });

      intakeSessions.set(channel.id, {
        userId: interaction.user.id,
        step: 0,
        answers: []
      });

      await channel.send({
        embeds: [new EmbedBuilder().setColor(0xff9900).setTitle("💼 טיקט מידלמן")]
      });

      await channel.send({
        embeds: [new EmbedBuilder().setColor(0x00bfff).setTitle("📝 שאלה 1").setDescription("מה אתה מציע?")]
      });

      return interaction.reply({ content: `נפתח: ${channel}`, ephemeral: true });
    }

    if (interaction.customId === "mm_close") {

      if (!interaction.member.roles.cache.has(MIDDLEMAN_ROLE_ID))
        return interaction.reply({ content: "❌ רק מידלמן", ephemeral: true });

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

        if (openerId) {
          const user = await client.users.fetch(openerId).catch(() => null);
          if (user) {
            await user.send({
              content: "📩 טיקט המידלמן שלך נסגר.",
              files: [transcript],
            }).catch(() => {});
          }
        }

        const log = await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (log) {
          await log.send({ content: "🔒 טיקט מידלמן נסגר", files: [transcript] });
        }

        intakeSessions.delete(interaction.channel.id);
        await interaction.channel.delete().catch(() => {});
      });
    }
  });

  client.on("messageCreate", async message => {
    if (!message.guild || message.author.bot) return;

    const session = intakeSessions.get(message.channel.id);
    if (!session) return;
    if (message.author.id !== session.userId) return;

    session.answers.push(message.content);
    session.step++;

    if (session.step === 1) {
      await message.channel.send({
        embeds: [new EmbedBuilder().setColor(0x00bfff).setTitle("📝 שאלה 2").setDescription("מה הצד השני מציע?")]
      });
      return;
    }

    if (session.step >= 2) {

      await message.channel.permissionOverwrites.edit(MIDDLEMAN_ROLE_ID, {
        ViewChannel: true,
        SendMessages: true
      });

      await message.channel.send({
        content: `<@&${MIDDLEMAN_ROLE_ID}>`,
        embeds: [new EmbedBuilder().setColor(0x00ff88).setTitle("📋 סיכום עסקה")]
      });
    }
  });

}

module.exports = { registerMiddlemanSystem };