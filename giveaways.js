const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const GIVEAWAYS_CHANNEL_ID = "1461674155689644075";
const GIVEAWAY_MANAGER_ROLE_ID = "1462791568426537033";

const FILE_PATH = path.join(__dirname, "giveaways_data.json");

function readData() {
  if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, "[]");
  return JSON.parse(fs.readFileSync(FILE_PATH));
}

function saveData(data) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
}

function registerGiveawaySystem(client) {

  setInterval(() => checkGiveaways(client), 10000);

  client.on("messageCreate", async (message) => {

    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member.roles.cache.has(GIVEAWAY_MANAGER_ROLE_ID)) return;

    // ================= START =================
    if (message.content.startsWith("!frogstart")) {

      const split = message.content.split("|");

      const args = split[0].split(" ");
      const time = Number(args[1]);
      const winners = Number(args[2]);
      const requiredInvites = Number(args[3]);
      const prize = split[1]?.trim();
      const image = split[2]?.trim();

      if (!time || !winners || !requiredInvites || !prize) {
        return message.reply(
          "❌ שימוש נכון:\n!frogstart זמן זוכים הזמנות | פרס | תמונה(לא חובה)"
        );
      }

      const ms = time * 60 * 1000;
      const endAt = Date.now() + ms;

      const embed = new EmbedBuilder()
        .setTitle("🎉 GIVEAWAY 🎉")
        .setColor(0xff00ff)
        .setDescription(
          `🏆 פרס: **${prize}**\n` +
          `👑 זוכים: **${winners}**\n` +
          `📨 חובה הזמנות: **${requiredInvites}**\n` +
          `⏳ זמן: **${time} דקות**\n\n` +
          `לחץ על הכפתור להשתתף!`
        )
        .setFooter({ text: "Frogixx Giveaways" })
        .setTimestamp();

      if (image) embed.setImage(image);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("giveaway_join")
          .setLabel("🎟️ השתתף")
          .setStyle(ButtonStyle.Success)
      );

      const channel = await message.guild.channels.fetch(GIVEAWAYS_CHANNEL_ID);

      const msg = await channel.send({
        content: "@everyone 🎉 הגרלה חדשה!",
        embeds: [embed],
        components: [row],
      });

      const data = readData();
      data.push({
        messageId: msg.id,
        channelId: channel.id,
        prize,
        winners,
        requiredInvites,
        endAt,
        entries: [],
      });

      saveData(data);

      return message.reply("✅ ההגרלה נפתחה בהצלחה.");
    }

    // ================= END =================
    if (message.content.startsWith("!frogend")) {

      const messageId = message.content.split(" ")[1];
      const data = readData();
      const g = data.find(x => x.messageId === messageId);

      if (!g) return message.reply("❌ לא נמצאה הגרלה.");

      g.endAt = Date.now();
      saveData(data);

      return message.reply("✅ סיימתי את ההגרלה.");
    }

    // ================= REROLL =================
    if (message.content.startsWith("!frogreroll")) {

      const messageId = message.content.split(" ")[1];
      const data = readData();
      const g = data.find(x => x.messageId === messageId);

      if (!g) return message.reply("❌ לא נמצאה הגרלה.");
      if (!g.entries.length) return message.reply("❌ אין משתתפים.");

      const winner =
        g.entries[Math.floor(Math.random() * g.entries.length)];

      const channel = await message.guild.channels.fetch(g.channelId);
      await channel.send(`🎉 רילרול! הזוכה החדש: <@${winner}>`);

      return message.reply("✅ בוצע רילרול.");
    }
  });

  // ================= BUTTON =================

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "giveaway_join") return;

    const data = readData();
    const giveaway = data.find(g => g.messageId === interaction.message.id);

    if (!giveaway) {
      return interaction.reply({
        content: "❌ ההגרלה נגמרה.",
        ephemeral: true,
      });
    }

    const invites = await interaction.guild.invites.fetch();
    let userInvites = 0;

    invites.forEach(inv => {
      if (inv.inviter && inv.inviter.id === interaction.user.id) {
        userInvites += inv.uses;
      }
    });

    if (userInvites < giveaway.requiredInvites) {
      return interaction.reply({
        content: `❌ צריך לפחות ${giveaway.requiredInvites} הזמנות.\nיש לך: ${userInvites}`,
        ephemeral: true,
      });
    }

    if (giveaway.entries.includes(interaction.user.id)) {
      return interaction.reply({
        content: "⚠️ אתה כבר בפנים.",
        ephemeral: true,
      });
    }

    giveaway.entries.push(interaction.user.id);
    saveData(data);

    return interaction.reply({
      content: "🎟️ נכנסת להגרלה!",
      ephemeral: true,
    });
  });
}

async function checkGiveaways(client) {

  const data = readData();
  if (!data.length) return;

  let changed = false;

  for (const g of data) {

    if (Date.now() < g.endAt) continue;

    const channel = await client.channels.fetch(g.channelId).catch(() => null);
    if (!channel) continue;

    if (!g.entries.length) {
      await channel.send(`❌ נגמרה הגרלה על **${g.prize}** ואין משתתפים.`);
      changed = true;
      continue;
    }

    const winners = [];
    const pool = [...new Set(g.entries)];

    while (winners.length < g.winners && pool.length > 0) {
      const rand = Math.floor(Math.random() * pool.length);
      winners.push(pool[rand]);
      pool.splice(rand, 1);
    }

    const winnersText = winners.map(id => `<@${id}>`).join(", ");

    await channel.send(`🎉 ההגרלה נגמרה!\n🏆 הזוכים: ${winnersText}`);

    changed = true;
  }

  if (changed) {
    const active = data.filter(g => Date.now() < g.endAt);
    saveData(active);
  }
}

module.exports = { registerGiveawaySystem };