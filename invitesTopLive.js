const { EmbedBuilder } = require("discord.js");
const fs = require("fs");

const INVITES_FILE = "./invites.json";
const TOP_INVITES_CHANNEL_ID = "1470764460107894868";

// שומר ID של ההודעה כדי לערוך אותה ולא לשלוח חדשה
const MESSAGE_STORE_FILE = "./top_invites_message.json";

function loadInvites() {
  try {
    if (!fs.existsSync(INVITES_FILE)) return {};
    return JSON.parse(fs.readFileSync(INVITES_FILE, "utf8"));
  } catch {
    return {};
  }
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString("en-US");
}

async function ensureMessage(channel) {
  let msgId = null;

  try {
    if (fs.existsSync(MESSAGE_STORE_FILE)) {
      msgId = JSON.parse(fs.readFileSync(MESSAGE_STORE_FILE, "utf8")).messageId;
    }
  } catch {}

  if (msgId) {
    const msg = await channel.messages.fetch(msgId).catch(() => null);
    if (msg) return msg;
  }

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle("🏆 Top 10 Invites")
    .setDescription("טוען נתונים...")
    .setFooter({ text: "Frogixx Invites System" })
    .setTimestamp();

  const msg = await channel.send({ embeds: [embed] });

  fs.writeFileSync(
    MESSAGE_STORE_FILE,
    JSON.stringify({ messageId: msg.id }, null, 2),
    "utf8"
  );

  return msg;
}

async function updateInvitesTop(client) {
  try {
    const channel = await client.channels.fetch(TOP_INVITES_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const msg = await ensureMessage(channel);

    const invites = loadInvites();

    // תומך גם אם invites.json שומר מספר, וגם אם הוא שומר אובייקט
    const sorted = Object.entries(invites)
      .map(([userId, data]) => {
        const count = typeof data === "number" ? data : data?.invites || 0;
        return [userId, count];
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    let desc = "";

    for (let i = 0; i < sorted.length; i++) {
      const [userId, count] = sorted[i];
      const user = await client.users.fetch(userId).catch(() => null);

      desc += `**${i + 1}.** ${user ? user.tag : `<@${userId}>`} — **${formatNumber(
        count
      )}** הזמנות\n`;
    }

    if (!desc) desc = "אין עדיין נתונים.";

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle("🏆 Top 10 Invites (כל השרת)")
      .setDescription(desc)
      .setFooter({ text: "מתעדכן כל דקה • Frogixx" })
      .setTimestamp();

    await msg.edit({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    console.log("InvitesTop update error:", err);
  }
}

function registerInvitesTopLive(client) {
  client.once("ready", async () => {
    console.log("מערכת Top Invites Live נטענה!");

    await updateInvitesTop(client);

    setInterval(async () => {
      await updateInvitesTop(client);
    }, 60_000);
  });
}

module.exports = { registerInvitesTopLive };
