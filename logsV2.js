const {
  AuditLogEvent,
  EmbedBuilder,
  ChannelType,
  Events,
} = require("discord.js");

// ====== הגדרות שלך ======
const GUILD_ID = "1461671595075436728";

const LOG_CHANNELS = {
  punish: "1470458890255859824",     // ban / mute / timeout
  messages: "1470459163715964969",   // edit / delete
  voice: "1470459528469282837",      // voice join/leave/move
  roleNick: "1470459666122277100",   // roles + nicknames
  channels: "1470460669819224137",   // create/delete/update channels
  giveaways: "1470826712395944081",  // ONLY giveaways
  joinLeave: "1470779822920826880",  // join / leave
};

const STAFF_ROLE_ID = "1462447685448630332";

// ====== עוזר לשליחת לוג ======
async function sendLog(client, channelId, embed) {
  const ch = await client.channels.fetch(channelId).catch(() => null);
  if (!ch) return;
  ch.send({ embeds: [embed] }).catch(() => {});
}

// ====== עוזר לאודיט לוג ======
async function getAudit(guild, type) {
  try {
    const logs = await guild.fetchAuditLogs({ limit: 1, type });
    return logs.entries.first() || null;
  } catch {
    return null;
  }
}

// ====== מערכת לוגים חדשה ======
function registerLogsV2(client) {
  // ========= JOIN / LEAVE =========
  client.on(Events.GuildMemberAdd, async (member) => {
    if (member.guild.id !== GUILD_ID) return;

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("✅ משתמש נכנס לשרת")
      .setDescription(`👤 ${member}  (**${member.user.tag}**)`)
      .addFields(
        { name: "🆔 ID", value: member.id, inline: true },
        { name: "👥 כמות בשרת", value: `${member.guild.memberCount}`, inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    await sendLog(client, LOG_CHANNELS.joinLeave, embed);
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    if (member.guild.id !== GUILD_ID) return;

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("❌ משתמש יצא מהשרת")
      .setDescription(`👤 **${member.user?.tag || "Unknown"}**`)
      .addFields(
        { name: "🆔 ID", value: member.id, inline: true },
        { name: "👥 כמות בשרת", value: `${member.guild.memberCount}`, inline: true }
      )
      .setTimestamp();

    await sendLog(client, LOG_CHANNELS.joinLeave, embed);
  });

  // ========= TIMEOUT / BAN / UNBAN =========
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (newMember.guild.id !== GUILD_ID) return;

    // Timeout שינוי
    if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
      const audit = await getAudit(newMember.guild, AuditLogEvent.MemberUpdate);

      const executor = audit?.executor ? `<@${audit.executor.id}>` : "לא ידוע";

      const until = newMember.communicationDisabledUntil
        ? `<t:${Math.floor(newMember.communicationDisabledUntil.getTime() / 1000)}:R>`
        : "בוטל";

      const embed = new EmbedBuilder()
        .setColor(0xfaa61a)
        .setTitle("⏳ Timeout עודכן")
        .setDescription(`👤 ${newMember} (**${newMember.user.tag}**)`)
        .addFields(
          { name: "👮 מי עשה", value: executor, inline: true },
          { name: "⏱️ מצב", value: until, inline: true }
        )
        .setTimestamp();

      await sendLog(client, LOG_CHANNELS.punish, embed);
    }
  });

  client.on(Events.GuildBanAdd, async (ban) => {
    if (ban.guild.id !== GUILD_ID) return;

    const audit = await getAudit(ban.guild, AuditLogEvent.MemberBanAdd);
    const executor = audit?.executor ? `<@${audit.executor.id}>` : "לא ידוע";
    const reason = audit?.reason || "לא נרשמה סיבה";

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("🔨 משתמש קיבל באן")
      .setDescription(`👤 **${ban.user.tag}**`)
      .addFields(
        { name: "👮 מי עשה", value: executor, inline: true },
        { name: "📌 סיבה", value: reason, inline: false }
      )
      .setTimestamp();

    await sendLog(client, LOG_CHANNELS.punish, embed);
  });

  client.on(Events.GuildBanRemove, async (ban) => {
    if (ban.guild.id !== GUILD_ID) return;

    const audit = await getAudit(ban.guild, AuditLogEvent.MemberBanRemove);
    const executor = audit?.executor ? `<@${audit.executor.id}>` : "לא ידוע";

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("✅ באן הוסר")
      .setDescription(`👤 **${ban.user.tag}**`)
      .addFields({ name: "👮 מי עשה", value: executor, inline: true })
      .setTimestamp();

    await sendLog(client, LOG_CHANNELS.punish, embed);
  });

  // ========= MESSAGE DELETE =========
  client.on(Events.MessageDelete, async (message) => {
    if (!message.guild) return;
    if (message.guild.id !== GUILD_ID) return;
    if (message.author?.bot) return;

    const audit = await getAudit(message.guild, AuditLogEvent.MessageDelete);
    const executor = audit?.executor ? `<@${audit.executor.id}>` : "לא ידוע";

    const content = message.content?.length
      ? message.content.slice(0, 1500)
      : "*אין טקסט*";

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("🗑️ הודעה נמחקה")
      .setDescription(`📍 חדר: ${message.channel}`)
      .addFields(
{
  name: "👤 נכתב על ידי",
  value: message.author ? `${message.author} (${message.author.tag})` : "`לא ידוע`",
  inline: false,
},
        { name: "👮 נמחק על ידי", value: executor, inline: false },
      {
  name: "💬 תוכן",
  value: `\`\`\`${content || "אין תוכן / לא נמצא"}\`\`\``,
  inline: false,
},

      )
      .setTimestamp();

    await sendLog(client, LOG_CHANNELS.messages, embed);
  });

  // ========= MESSAGE EDIT =========
  client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    if (!newMsg.guild) return;
    if (newMsg.guild.id !== GUILD_ID) return;
    if (newMsg.author?.bot) return;

    if (oldMsg.content === newMsg.content) return;

    const before = oldMsg.content?.slice(0, 900) || "*ריק*";
    const after = newMsg.content?.slice(0, 900) || "*ריק*";

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("✏️ הודעה נערכה")
      .setDescription(`📍 חדר: ${newMsg.channel}`)
      .addFields(
        { name: "👤 מי ערך", value: `${newMsg.author} (${newMsg.author.tag})`, inline: false },
        { name: "⬅️ לפני", value: `\`\`\`${before}\`\`\``, inline: false },
        { name: "➡️ אחרי", value: `\`\`\`${after}\`\`\``, inline: false }
      )
      .setTimestamp();

    await sendLog(client, LOG_CHANNELS.messages, embed);
  });

  // ========= VOICE =========
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (newState.guild.id !== GUILD_ID) return;

    const member = newState.member;
    if (!member) return;
    if (member.user.bot) return;

    // Join voice
    if (!oldState.channelId && newState.channelId) {
      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("🔊 נכנס לשיחה")
        .setDescription(`👤 ${member} (**${member.user.tag}**)`)
        .addFields({ name: "📍 חדר", value: `${newState.channel}`, inline: true })
        .setTimestamp();

      return sendLog(client, LOG_CHANNELS.voice, embed);
    }

    // Leave voice
    if (oldState.channelId && !newState.channelId) {
      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("🔇 יצא משיחה")
        .setDescription(`👤 ${member} (**${member.user.tag}**)`)
        .addFields({ name: "📍 חדר", value: `${oldState.channel}`, inline: true })
        .setTimestamp();

      return sendLog(client, LOG_CHANNELS.voice, embed);
    }

    // Move voice
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const audit = await getAudit(newState.guild, AuditLogEvent.MemberMove);
      const executor = audit?.executor ? `<@${audit.executor.id}>` : "לא ידוע";

      const embed = new EmbedBuilder()
        .setColor(0xfaa61a)
        .setTitle("➡️ הועבר בין שיחות")
        .setDescription(`👤 ${member} (**${member.user.tag}**)`)
        .addFields(
          { name: "⬅️ מ", value: `${oldState.channel}`, inline: true },
          { name: "➡️ ל", value: `${newState.channel}`, inline: true },
          { name: "👮 מי העביר", value: executor, inline: false }
        )
        .setTimestamp();

      return sendLog(client, LOG_CHANNELS.voice, embed);
    }
  });

  // ========= ROLE + NICK =========
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (newMember.guild.id !== GUILD_ID) return;

    // Nickname
    if (oldMember.nickname !== newMember.nickname) {
      const audit = await getAudit(newMember.guild, AuditLogEvent.MemberUpdate);
      const executor = audit?.executor ? `<@${audit.executor.id}>` : "לא ידוע";

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle("📝 שינוי ניק")
        .setDescription(`👤 ${newMember} (**${newMember.user.tag}**)`)
        .addFields(
          { name: "👮 מי שינה", value: executor, inline: true },
          { name: "⬅️ לפני", value: oldMember.nickname || oldMember.user.username, inline: true },
          { name: "➡️ אחרי", value: newMember.nickname || newMember.user.username, inline: true }
        )
        .setTimestamp();

      await sendLog(client, LOG_CHANNELS.roleNick, embed);
    }

    // Roles
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const added = newRoles.filter((r) => !oldRoles.has(r.id));
    const removed = oldRoles.filter((r) => !newRoles.has(r.id));

    if (added.size || removed.size) {
      const audit = await getAudit(newMember.guild, AuditLogEvent.MemberRoleUpdate);
      const executor = audit?.executor ? `<@${audit.executor.id}>` : "לא ידוע";

      const embed = new EmbedBuilder()
        .setColor(0x2f3136)
        .setTitle("🎭 שינוי רולים")
        .setDescription(`👤 ${newMember} (**${newMember.user.tag}**)`)
        .addFields(
          { name: "👮 מי שינה", value: executor, inline: false },
          { name: "➕ נוסף", value: added.size ? added.map((r) => r.toString()).join("\n") : "—", inline: true },
          { name: "➖ הוסר", value: removed.size ? removed.map((r) => r.toString()).join("\n") : "—", inline: true }
        )
        .setTimestamp();

      await sendLog(client, LOG_CHANNELS.roleNick, embed);
    }
  });

  // ========= CHANNEL CREATE / DELETE / UPDATE =========
  client.on(Events.ChannelCreate, async (channel) => {
    if (!channel.guild) return;
    if (channel.guild.id !== GUILD_ID) return;

    const audit = await getAudit(channel.guild, AuditLogEvent.ChannelCreate);
    const executor = audit?.executor ? `<@${audit.executor.id}>` : "לא ידוע";

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("📌 חדר נוצר")
      .setDescription(`📍 ${channel} (${channel.name})`)
      .addFields(
        { name: "👮 מי יצר", value: executor, inline: true },
        { name: "🆔 ID", value: channel.id, inline: true }
      )
      .setTimestamp();

    await sendLog(client, LOG_CHANNELS.channels, embed);
  });

  client.on(Events.ChannelDelete, async (channel) => {
    if (!channel.guild) return;
    if (channel.guild.id !== GUILD_ID) return;

    const audit = await getAudit(channel.guild, AuditLogEvent.ChannelDelete);
    const executor = audit?.executor ? `<@${audit.executor.id}>` : "לא ידוע";

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("🗑️ חדר נמחק")
      .setDescription(`📍 **${channel.name}**`)
      .addFields(
        { name: "👮 מי מחק", value: executor, inline: true },
        { name: "🆔 ID", value: channel.id, inline: true }
      )
      .setTimestamp();

    await sendLog(client, LOG_CHANNELS.channels, embed);
  });

  client.on(Events.ChannelUpdate, async (oldCh, newCh) => {
    if (!newCh.guild) return;
    if (newCh.guild.id !== GUILD_ID) return;

    if (oldCh.name === newCh.name) return;

    const audit = await getAudit(newCh.guild, AuditLogEvent.ChannelUpdate);
    const executor = audit?.executor ? `<@${audit.executor.id}>` : "לא ידוע";

    const embed = new EmbedBuilder()
      .setColor(0xfaa61a)
      .setTitle("✏️ חדר שונה")
      .setDescription(`📍 ${newCh}`)
      .addFields(
        { name: "👮 מי שינה", value: executor, inline: false },
        { name: "⬅️ לפני", value: oldCh.name, inline: true },
        { name: "➡️ אחרי", value: newCh.name, inline: true }
      )
      .setTimestamp();

    await sendLog(client, LOG_CHANNELS.channels, embed);
  });

  console.log("✅ Logs V2 נטען בהצלחה!");
}

module.exports = { registerLogsV2 };
