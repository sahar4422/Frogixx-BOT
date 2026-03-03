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
const MIDDLEMAN_PANEL_ID = "1461697151443665042";

const TICKETS_CATEGORY_ID = "1470412075162534114";

const STAFF_ROLE_ID = "1462447685448630332";
const MIDDLEMAN_ROLE_ID = "1470405079613050951";

const LOG_CHANNEL_ID = "1470143249720279164";

const intakeSessions = new Map();
const callCooldown = new Map();

// ================= QUESTIONS =================

const QUESTIONS = {
  general: [
    "🆘 מה הבעיה שלך?",
    "📌 מה ניסית כבר לעשות?",
    "📎 יש הוכחות?"
  ],
  bug: [
    "🐞 מה הבאג?",
    "🕒 מתי זה קרה?",
    "📍 איפה זה קרה?"
  ],
  staff: [
    "👮 על איזה איש צוות מדובר?",
    "📌 מה קרה?",
    "📎 יש הוכחות?"
  ],
  base: [
    "🏠 איזה בייס תרצה?",
    "💰 יש לך פיקדון?"
  ],
  other: [
    "📝 מה הנושא?",
    "📌 תסביר בפירוט."
  ],
  middleman: [
    "💰 מה אתה מציע בעסקה?",
    "🤝 מה הצד השני מציע?"
  ]
};

function registerTicketSystem(client) {

  // ================= CREATE PANELS =================

  client.once("ready", async () => {

    // רגיל
    await createPanel(client, SUPPORT_PANEL_ID, false);

    // מידלמן
    await createPanel(client, MIDDLEMAN_PANEL_ID, true);

  });

  async function createPanel(client, channelId, isMiddleman) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const messages = await channel.messages.fetch({ limit: 20 });
    const exists = messages.find(m =>
      m.components?.[0]?.components?.some(c =>
        c.customId?.startsWith(isMiddleman ? "open_middleman" : "open_ticket")
      )
    );
    if (exists) return;

    const embed = new EmbedBuilder()
      .setColor(isMiddleman ? 0xff9900 : 0x00c8ff)
      .setTitle(isMiddleman ? "💼 מערכת מידלמן" : "🎫 מערכת טיקטים")
      .setDescription(
        isMiddleman
          ? "פתח טיקט מידלמן בצורה בטוחה ומאובטחת."
          : "פתח טיקט ותשלים שאלון קצר לפני שהצוות יראה."
      )
      .setFooter({ text: "Frogixx System" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(isMiddleman ? "open_middleman" : "open_ticket_general")
        .setLabel(isMiddleman ? "פתח טיקט מידלמן" : "פתח טיקט")
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });
  }

  // ================= BUTTONS =================

  client.on("interactionCreate", async interaction => {

    if (!interaction.isButton()) return;

    // ===== OPEN MIDDLEMAN =====
    if (interaction.customId === "open_middleman") {
      return openTicket(interaction, "middleman", true);
    }

    // ===== OPEN NORMAL =====
    if (interaction.customId.startsWith("open_ticket_")) {
      const type = interaction.customId.replace("open_ticket_", "");
      return openTicket(interaction, type, false);
    }

    // ===== MEMBER OPTIONS =====
    if (interaction.customId === "member_options") {

      const session = intakeSessions.get(interaction.channel.id);
      if (!session) return;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("call_staff")
          .setLabel("קריאה לצוות")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("request_close")
          .setLabel("בקשת סגירה")
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({ content: "בחר אפשרות:", components: [row], ephemeral: true });
    }

    // ===== CALL =====
    if (interaction.customId === "call_staff") {

      const session = intakeSessions.get(interaction.channel.id);
      if (!session) return;

      const role = session.isMiddleman ? MIDDLEMAN_ROLE_ID : STAFF_ROLE_ID;

      const last = callCooldown.get(interaction.user.id);
      if (last && Date.now() - last < 300000)
        return interaction.reply({ content: "⏳ ניתן לקרוא לצוות פעם ב-5 דקות.", ephemeral: true });

      callCooldown.set(interaction.user.id, Date.now());

      await interaction.channel.send(`<@${interaction.user.id}> מבקש צוות\n<@&${role}>`);

      return interaction.reply({ content: "✅ הצוות תוייג.", ephemeral: true });
    }

    // ===== CLAIM =====
    if (interaction.customId === "claim_ticket") {

      const session = intakeSessions.get(interaction.channel.id);
      if (!session) return;

      const role = session.isMiddleman ? MIDDLEMAN_ROLE_ID : STAFF_ROLE_ID;

      if (!interaction.member.roles.cache.has(role))
        return interaction.reply({ content: "❌ רק צוות מתאים יכול לקחת.", ephemeral: true });

      await interaction.channel.send(`🧑‍✈️ נלקח על ידי <@${interaction.user.id}>`);
      return interaction.reply({ content: "✅ לקחת.", ephemeral: true });
    }

    // ===== CLOSE =====
    if (interaction.customId === "close_ticket") {

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
          content: `🔒 טיקט נסגר על ידי <@${interaction.user.id}>`,
          files: [transcript]
        });

        await interaction.channel.delete();
      });
    }

  });

  // ================= OPEN FUNCTION =================

  async function openTicket(interaction, type, isMiddleman) {

    const role = isMiddleman ? MIDDLEMAN_ROLE_ID : STAFF_ROLE_ID;

    const channel = await interaction.guild.channels.create({
      name: `${type}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: TICKETS_CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: role, deny: [PermissionFlagsBits.ViewChannel] }
      ]
    });

    const embed = new EmbedBuilder()
      .setColor(isMiddleman ? 0xff9900 : 0x2f3136)
      .setTitle(isMiddleman ? "💼 טיקט מידלמן" : "🎫 טיקט חדש")
      .setDescription("📝 אנא השלם את השאלון למטה.\n\n━━━━━━━━━━━━━━━━━━━━");

    const controls = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_ticket")
        .setLabel("קח טיקט")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("סגור טיקט")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("member_options")
        .setLabel("אפשרויות ממבר")
        .setStyle(ButtonStyle.Secondary)
    );

    await channel.send({ embeds: [embed], components: [controls] });

    intakeSessions.set(channel.id, {
      userId: interaction.user.id,
      type,
      step: 0,
      answers: [],
      isMiddleman
    });

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00bfff)
          .setTitle("📝 שאלה 1")
          .setDescription(QUESTIONS[type][0])
      ]
    });

    await interaction.reply({ content: `✅ נפתח: ${channel}`, ephemeral: true });
  }

  // ================= QUESTION FLOW =================

  client.on("messageCreate", async message => {

    if (!message.guild || message.author.bot) return;

    const session = intakeSessions.get(message.channel.id);
    if (!session) return;
    if (message.author.id !== session.userId) return;

    const questions = QUESTIONS[session.type];

    session.answers.push(message.content);
    session.step++;

    if (session.step >= questions.length) {

      const role = session.isMiddleman ? MIDDLEMAN_ROLE_ID : STAFF_ROLE_ID;

      await message.channel.permissionOverwrites.edit(role, {
        ViewChannel: true,
        SendMessages: true
      });

      let summary = "";
      for (let i = 0; i < questions.length; i++) {
        summary += `**${questions[i]}**\n${session.answers[i]}\n\n`;
      }

      await message.channel.send({
        content: `<@&${role}>`,
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ff88)
            .setTitle("📋 סיכום הטיקט")
            .setDescription(summary.slice(0, 3800))
        ]
      });

      intakeSessions.delete(message.channel.id);
      return;
    }

    await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00bfff)
          .setTitle(`📝 שאלה ${session.step + 1}`)
          .setDescription(questions[session.step])
      ]
    });

  });

}

module.exports = { registerTicketSystem };