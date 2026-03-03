const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

const { createTranscript } = require("discord-html-transcripts");

// ================= SETTINGS =================

const MIDDLEMAN_PANEL_ID = "1461697151443665042";
const TICKETS_CATEGORY_ID = "1470412075162534114";
const MIDDLEMAN_ROLE_ID = "1470405079613050951";
const LOG_CHANNEL_ID = "1470143249720279164";

// ================= STORAGE =================

const intakeSessions = new Map();
const callCooldown = new Map();

// ================= REGISTER =================

function registerMiddlemanSystem(client) {

  // ===== CREATE PANEL =====
  client.once("ready", async () => {

    const channel = await client.channels.fetch(MIDDLEMAN_PANEL_ID).catch(() => null);
    if (!channel) return;

    const messages = await channel.messages.fetch({ limit: 20 });
    const exists = messages.find(m =>
      m.components?.[0]?.components?.some(c => c.customId === "open_middleman_ticket")
    );

    if (exists) return;

    const embed = new EmbedBuilder()
      .setColor(0xff9900)
      .setTitle("💼 מערכת מידלמן מאובטחת")
      .setDescription(
        "פתח טיקט מידלמן בצורה בטוחה.\n\n" +
        "🔒 שני הצדדים מציינים מה הם מציעים\n" +
        "👮 רק צוות מידלמן יוכל לצפות לאחר השאלון\n\n" +
        "━━━━━━━━━━━━━━━━━━━━"
      )
      .setFooter({ text: "Frogixx Middleman System" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_middleman_ticket")
        .setLabel("פתח טיקט מידלמן")
        .setEmoji("💼")
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });
  });

  // ================= INTERACTIONS =================

  client.on("interactionCreate", async interaction => {

    if (!interaction.isButton()) return;

    // ===== OPEN =====
    if (interaction.customId === "open_middleman_ticket") {

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

      const embed = new EmbedBuilder()
        .setColor(0xff9900)
        .setTitle("💼 טיקט מידלמן נפתח")
        .setDescription(
          `👤 נפתח על ידי: <@${interaction.user.id}>\n\n` +
          "📝 אנא השלם את השאלון למטה.\n\n" +
          "━━━━━━━━━━━━━━━━━━━━"
        );

      const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("mm_claim")
          .setLabel("קח טיקט")
          .setEmoji("🧑‍✈️")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("mm_close")
          .setLabel("סגור טיקט")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("mm_member_options")
          .setLabel("אפשרויות ממבר")
          .setEmoji("⚙️")
          .setStyle(ButtonStyle.Secondary)
      );

      await channel.send({ embeds: [embed], components: [controls] });

      intakeSessions.set(channel.id, {
        userId: interaction.user.id,
        step: 0,
        answers: []
      });

      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00bfff)
            .setTitle("📝 שאלה 1")
            .setDescription("💰 מה אתה מציע בעסקה?")
        ]
      });

      return interaction.reply({ content: `✅ הטיקט נפתח: ${channel}`, ephemeral: true });
    }

    // ===== MEMBER OPTIONS =====
    if (interaction.customId === "mm_member_options") {

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("mm_call")
          .setLabel("קריאה לצוות")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("mm_request_close")
          .setLabel("בקשת סגירה")
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({
        content: "בחר אפשרות:",
        components: [row],
        ephemeral: true
      });
    }

    // ===== CALL STAFF =====
    if (interaction.customId === "mm_call") {

      const last = callCooldown.get(interaction.user.id);
      if (last && Date.now() - last < 300000)
        return interaction.reply({ content: "⏳ ניתן לקרוא לצוות פעם ב-5 דקות.", ephemeral: true });

      callCooldown.set(interaction.user.id, Date.now());

      await interaction.channel.send(
        `📢 <@${interaction.user.id}> מבקש מידלמן!\n<@&${MIDDLEMAN_ROLE_ID}>`
      );

      return interaction.reply({ content: "✅ הצוות תוייג.", ephemeral: true });
    }

    // ===== REQUEST CLOSE =====
    if (interaction.customId === "mm_request_close") {

      await interaction.channel.send(
        `🔔 <@${interaction.user.id}> מבקש לסגור את הטיקט.\n<@&${MIDDLEMAN_ROLE_ID}>`
      );

      return interaction.reply({ content: "✅ הבקשה נשלחה.", ephemeral: true });
    }

    // ===== CLAIM =====
    if (interaction.customId === "mm_claim") {

      if (!interaction.member.roles.cache.has(MIDDLEMAN_ROLE_ID))
        return interaction.reply({ content: "❌ רק צוות מידלמן יכול לקחת.", ephemeral: true });

      await interaction.channel.send(`🧑‍✈️ הטיקט נלקח על ידי <@${interaction.user.id}>`);
      return interaction.reply({ content: "✅ לקחת.", ephemeral: true });
    }

    // ===== CLOSE =====
    if (interaction.customId === "mm_close") {

      if (!interaction.member.roles.cache.has(MIDDLEMAN_ROLE_ID))
        return interaction.reply({ content: "❌ רק צוות מידלמן יכול לסגור.", ephemeral: true });

      await interaction.channel.send("⚠️ במידה ולא תשלח הודעה ב-5 שניות הקרובות הטיקט ייסגר.");

      const collector = interaction.channel.createMessageCollector({ time: 5000 });
      let canceled = false;

      collector.on("collect", () => {
        canceled = true;
        collector.stop();
      });

      collector.on("end", async () => {

        if (canceled) {
          interaction.channel.send("❌ הסגירה בוטלה.");
          return;
        }

        const transcript = await createTranscript(interaction.channel);
const openerId = intakeSessions.get(interaction.channel.id)?.userId;

if (openerId) {
  const user = await interaction.client.users.fetch(openerId).catch(() => null);
  if (user) {
    await user.send({
      content: "📩 הטיקט שלך נסגר. מצורף טרנסקריפט:",
      files: [transcript],
    }).catch(() => {});
  }
}

        const log = await interaction.guild.channels.fetch(LOG_CHANNEL_ID);

        await log.send({
          content: `🔒 טיקט מידלמן נסגר על ידי <@${interaction.user.id}>`,
          files: [transcript]
        });

        await interaction.channel.delete();
      });
    }

  });

  // ================= QUESTION FLOW =================

  client.on("messageCreate", async message => {

    if (!message.guild || message.author.bot) return;

    const session = intakeSessions.get(message.channel.id);
    if (!session) return;
    if (message.author.id !== session.userId) return;

    session.answers.push(message.content);
    session.step++;

    if (session.step === 1) {

      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00bfff)
            .setTitle("📝 שאלה 2")
            .setDescription("🤝 מה הצד השני מציע?")
        ]
      });

      return;
    }

    if (session.step >= 2) {

      await message.channel.permissionOverwrites.edit(MIDDLEMAN_ROLE_ID, {
        ViewChannel: true,
        SendMessages: true
      });

      const summary =
        `💰 **מה הוא מציע:**\n${session.answers[0]}\n\n` +
        `🤝 **מה הצד השני מציע:**\n${session.answers[1]}`;

      await message.channel.send({
        content: `<@&${MIDDLEMAN_ROLE_ID}>`,
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ff88)
            .setTitle("📋 סיכום עסקה")
            .setDescription(summary)
        ]
      });

      intakeSessions.delete(message.channel.id);
    }

  });

}

module.exports = { registerMiddlemanSystem };