const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

// =====================
// SETTINGS
// =====================
const CASINO_LOG_CHANNEL_ID = "1472150280551403551";
const CASINO_ADMIN_ROLE_ID = "1469293649715269723";
const START_BALANCE = 1000;

const DATA_FILE = path.join(__dirname, "casino_data.json");

// מזל לפי רולים
const LUCK_ROLE_BONUS = [
  { roleId: "1469297874927095921", bonus: 0.10 },
  { roleId: "1469300419703476512", bonus: 0.20 },
  { roleId: "1469297254941720577", bonus: 0.30 },
  { roleId: "1469300005973135431", bonus: 0.40 },
  { roleId: "1469300573579903067", bonus: 0.50 },
  { roleId: "1469300611186167873", bonus: 0.60 },
  { roleId: "1469300675287449686", bonus: 0.70 },
  { roleId: "1469300711685881969", bonus: 0.80 },
  { roleId: "1469300760092213342", bonus: 0.90 },
];

// cooldowns
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const WORK_COOLDOWN_MS = 10 * 60 * 1000;
const WHEEL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// =====================
// JSON SAFE
// =====================
function readJsonSafe(file, fallback) {
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
    const raw = fs.readFileSync(file, "utf8");
    if (!raw || raw.trim() === "") return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonSafe(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch {}
}

// =====================
// STORAGE
// =====================
function getAll() {
  return readJsonSafe(DATA_FILE, {});
}

function saveAll(data) {
  writeJsonSafe(DATA_FILE, data);
}

function ensureUser(userId) {
  const data = getAll();
  if (!data[userId]) {
    data[userId] = {
      balance: START_BALANCE,
      dailyLast: 0,
      workLast: 0,
      wheelLast: 0,
      wins: 0,
      losses: 0,
    };
    saveAll(data);
  }
  return data[userId];
}

function setUser(userId, obj) {
  const data = getAll();
  data[userId] = obj;
  saveAll(data);
}

// =====================
// HELPERS
// =====================
function formatMoney(n) {
  return `${Number(n).toLocaleString()} 💰`;
}

function getLuckBonus(member) {
  if (!member) return 0;
  let best = 0;
  for (const r of LUCK_ROLE_BONUS) {
    if (member.roles.cache.has(r.roleId)) best = Math.max(best, r.bonus);
  }
  return best;
}

function hasCasinoAdmin(member) {
  return member?.roles?.cache?.has(CASINO_ADMIN_ROLE_ID);
}

function clampBet(bet) {
  if (!bet || bet <= 0) return null;
  return Math.floor(bet);
}

function chance(baseChance, luckBonus) {
  const boosted = baseChance * (1 + luckBonus);
  return Math.min(boosted, 0.95);
}

function rollWin(winChance) {
  return Math.random() < winChance;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);

  if (hr > 0) return `${hr} שעות`;
  if (min > 0) return `${min} דקות`;
  return `${sec} שניות`;
}

async function logCasino(client, guild, text) {
  try {
    const ch = await client.channels.fetch(CASINO_LOG_CHANNEL_ID).catch(() => null);
    if (!ch) return;

    const embed = new EmbedBuilder()
      .setColor(0x00ffaa)
      .setTitle("🎰 Casino Log")
      .setDescription(text)
      .setFooter({ text: "Frogixx • Casino" })
      .setTimestamp();

    await ch.send({ embeds: [embed] });
  } catch {}
}

// =====================
// BLACKJACK HELPERS
// =====================
function drawCard() {
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const suits = ["♠️", "♥️", "♦️", "♣️"];
  return { rank: pick(ranks), suit: pick(suits) };
}

function cardValue(rank) {
  if (rank === "A") return 11;
  if (["K", "Q", "J"].includes(rank)) return 10;
  return Number(rank);
}

function handValue(hand) {
  let total = 0;
  let aces = 0;

  for (const c of hand) {
    total += cardValue(c.rank);
    if (c.rank === "A") aces++;
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

function showHand(hand, hideSecond = false) {
  if (!hand.length) return "";
  return hand
    .map((c, i) => {
      if (hideSecond && i === 1) return "🂠";
      return `${c.rank}${c.suit}`;
    })
    .join("  ");
}

// =====================
// WHEEL ANIMATION
// =====================
async function wheelAnimation(interaction, finalText) {
  const frames = ["🎡", "🎰", "🎲", "🪙", "💎", "🍒", "7️⃣"];
  let text = "";

  for (let i = 0; i < 8; i++) {
    text = `${pick(frames)} ${pick(frames)} ${pick(frames)}  ...`;
    await interaction.editReply({ content: text }).catch(() => {});
    await sleep(450);
  }

  await interaction.editReply({ content: finalText }).catch(() => {});
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// =====================
// SLASH
// =====================
function buildCasinoSlash() {
  return new SlashCommandBuilder()
    .setName("casino")
    .setDescription("🎰 מערכת קזינו (Frogixx)")
    .addSubcommand((sub) => sub.setName("help").setDescription("📌 רשימת כל הפקודות"))
    .addSubcommand((sub) => sub.setName("balance").setDescription("בדוק כמה כסף יש לך"))
    .addSubcommand((sub) => sub.setName("daily").setDescription("קבל כסף יומי"))
    .addSubcommand((sub) => sub.setName("work").setDescription("עבוד כדי לקבל כסף (Cooldown)"))
    .addSubcommand((sub) => sub.setName("wheel").setDescription("🎡 גלגל מזל יומי עם אנימציה"))
    .addSubcommand((sub) =>
      sub
        .setName("coinflip")
        .setDescription("🪙 הטלת מטבע")
        .addIntegerOption((o) => o.setName("bet").setDescription("כמה להמר?").setRequired(true).setMinValue(1))
        .addStringOption((o) =>
          o
            .setName("side")
            .setDescription("מה אתה בוחר?")
            .setRequired(true)
            .addChoices(
              { name: "עץ", value: "tails" },
              { name: "פלי", value: "heads" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("slots")
        .setDescription("🎰 מכונת מזל")
        .addIntegerOption((o) => o.setName("bet").setDescription("כמה להמר?").setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub
        .setName("dice")
        .setDescription("🎲 קוביות (גבוה מנצח)")
        .addIntegerOption((o) => o.setName("bet").setDescription("כמה להמר?").setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub
        .setName("highlow")
        .setDescription("📈📉 נחש אם יצא גבוה או נמוך")
        .addIntegerOption((o) => o.setName("bet").setDescription("כמה להמר?").setRequired(true).setMinValue(1))
        .addStringOption((o) =>
          o
            .setName("pick")
            .setDescription("מה אתה בוחר?")
            .setRequired(true)
            .addChoices(
              { name: "גבוה (6-10)", value: "high" },
              { name: "נמוך (1-5)", value: "low" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("roulette")
        .setDescription("🎡 רולטה")
        .addIntegerOption((o) => o.setName("bet").setDescription("כמה להמר?").setRequired(true).setMinValue(1))
        .addStringOption((o) =>
          o
            .setName("color")
            .setDescription("על מה להמר?")
            .setRequired(true)
            .addChoices(
              { name: "אדום", value: "red" },
              { name: "שחור", value: "black" },
              { name: "ירוק (סיכוי נמוך רווח גבוה)", value: "green" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("blackjack")
        .setDescription("🃏 בלאק ג'ק")
        .addIntegerOption((o) => o.setName("bet").setDescription("כמה להמר?").setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub
        .setName("crash")
        .setDescription("📈 Crash (סיכון גבוה)")
        .addIntegerOption((o) => o.setName("bet").setDescription("כמה להמר?").setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) => sub.setName("top").setDescription("🏆 טופ כסף בשרת"))
    // ADMIN
    .addSubcommand((sub) =>
      sub
        .setName("addmoney")
        .setDescription("🛠️ (Admin) הוסף כסף למישהו")
        .addUserOption((o) => o.setName("user").setDescription("למי?").setRequired(true))
        .addIntegerOption((o) => o.setName("amount").setDescription("כמה?").setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub
        .setName("setmoney")
        .setDescription("🛠️ (Admin) קבע כסף למישהו")
        .addUserOption((o) => o.setName("user").setDescription("למי?").setRequired(true))
        .addIntegerOption((o) => o.setName("amount").setDescription("כמה?").setRequired(true).setMinValue(0))
    );
}

// =====================
// REGISTER
// =====================
function registerCasinoSystem(client) {
  client.once("ready", () => console.log("✅ Casino MEGA system loaded!"));

  client.on("interactionCreate", async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== "casino") return;

      const sub = interaction.options.getSubcommand();
      const member = interaction.member;
      const userId = interaction.user.id;

      const u = ensureUser(userId);
      const luck = getLuckBonus(member);

      // HELP
      if (sub === "help") {
        const embed = new EmbedBuilder()
          .setColor(0xff00ff)
          .setTitle("🎰 Frogixx Casino • פקודות")
          .setDescription(
            `💰 **כללי**\n` +
              `• \`/casino balance\` - בדיקת כסף\n` +
              `• \`/casino daily\` - כסף יומי\n` +
              `• \`/casino work\` - עבודה (Cooldown)\n` +
              `• \`/casino wheel\` - גלגל מזל יומי 🎡\n\n` +
              `🎲 **משחקים**\n` +
              `• \`/casino coinflip\`\n` +
              `• \`/casino slots\`\n` +
              `• \`/casino dice\`\n` +
              `• \`/casino highlow\`\n` +
              `• \`/casino roulette\`\n` +
              `• \`/casino blackjack\`\n` +
              `• \`/casino crash\`\n\n` +
              `🏆 **טופ**\n` +
              `• \`/casino top\`\n\n` +
              `🛠️ **מנהל קזינו**\n` +
              `• \`/casino addmoney\`\n` +
              `• \`/casino setmoney\`\n\n` +
              `🍀 **מזל מהרולים שלך:** **${Math.round(luck * 100)}%**`
          )
          .setFooter({ text: "Frogixx • Casino Mega" })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // BALANCE
      if (sub === "balance") {
        const embed = new EmbedBuilder()
          .setColor(0x00ffaa)
          .setTitle("💰 היתרה שלך")
          .setDescription(
            `👤 <@${userId}>\n\n` +
              `💵 כסף: **${formatMoney(u.balance)}**\n` +
              `🍀 מזל: **${Math.round(luck * 100)}%**\n\n` +
              `🏆 ניצחונות: **${u.wins}**\n` +
              `💀 הפסדים: **${u.losses}**`
          )
          .setFooter({ text: "Frogixx • Casino" })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // DAILY
      if (sub === "daily") {
        const now = Date.now();
        const left = DAILY_COOLDOWN_MS - (now - u.dailyLast);

        if (left > 0) {
          return interaction.reply({
            content: `⏳ כבר לקחת Daily.\nנסה שוב בעוד: **${formatTime(left)}**`,
            ephemeral: true,
          });
        }

        const rewardBase = 500;
        const reward = Math.floor(rewardBase * (1 + luck));

        u.balance += reward;
        u.dailyLast = now;
        setUser(userId, u);

        await logCasino(client, interaction.guild, `📅 Daily | <@${userId}> קיבל ${formatMoney(reward)}`);

        return interaction.reply({
          content: `✅ קיבלת Daily: **${formatMoney(reward)}**`,
          ephemeral: true,
        });
      }

      // WORK
      if (sub === "work") {
        const now = Date.now();
        const left = WORK_COOLDOWN_MS - (now - u.workLast);

        if (left > 0) {
          return interaction.reply({
            content: `⏳ אתה יכול לעבוד שוב בעוד: **${formatTime(left)}**`,
            ephemeral: true,
          });
        }

        const base = randInt(200, 450);
        const reward = Math.floor(base * (1 + luck));

        u.balance += reward;
        u.workLast = now;
        setUser(userId, u);

        await logCasino(client, interaction.guild, `🛠️ Work | <@${userId}> קיבל ${formatMoney(reward)}`);

        return interaction.reply({
          content: `🛠️ עבדת וקיבלת: **${formatMoney(reward)}**`,
          ephemeral: true,
        });
      }

      // WHEEL
      if (sub === "wheel") {
        const now = Date.now();
        const left = WHEEL_COOLDOWN_MS - (now - u.wheelLast);

        if (left > 0) {
          return interaction.reply({
            content: `⏳ כבר סובבת גלגל היום.\nנסה שוב בעוד: **${formatTime(left)}**`,
            ephemeral: true,
          });
        }

        await interaction.reply({ content: "🎡 מסובב את הגלגל..." });

        // פרסים
        const prizes = [
          { name: "💀 כלום", amount: 0, weight: 30 },
          { name: "💰 200", amount: 200, weight: 25 },
          { name: "💰 500", amount: 500, weight: 18 },
          { name: "💰 1000", amount: 1000, weight: 12 },
          { name: "💎 2500", amount: 2500, weight: 8 },
          { name: "🎁 5000", amount: 5000, weight: 5 },
          { name: "👑 10000", amount: 10000, weight: 2 },
        ];

        // מזל מגדיל קצת את הסיכוי לפרסים גבוהים
        // (לא יותר מדי כדי לא לשבור את הכלכלה)
        const final = weightedPick(prizes, luck);

        u.balance += final.amount;
        u.wheelLast = now;
        setUser(userId, u);

        await wheelAnimation(
          interaction,
          `🎡 הגלגל נעצר!\n🏆 זכית: **${final.name}**\n💰 יתרה חדשה: **${formatMoney(u.balance)}**`
        );

        await logCasino(
          client,
          interaction.guild,
          `🎡 Wheel | <@${userId}> זכה: ${final.name} | מזל: ${Math.round(luck * 100)}%`
        );

        return;
      }

      // TOP
      if (sub === "top") {
        const all = getAll();
        const arr = Object.entries(all)
          .map(([id, obj]) => ({ id, bal: Number(obj.balance) || 0 }))
          .sort((a, b) => b.bal - a.bal)
          .slice(0, 10);

        let text = "";
        for (let i = 0; i < arr.length; i++) {
          text += `🏆 **#${i + 1}** <@${arr[i].id}> — **${formatMoney(arr[i].bal)}**\n`;
        }

        const embed = new EmbedBuilder()
          .setColor(0xffcc00)
          .setTitle("🏆 טופ כסף (קזינו)")
          .setDescription(text || "אין נתונים עדיין.")
          .setFooter({ text: "Frogixx • Casino" })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      // ADMIN
      if (sub === "addmoney" || sub === "setmoney") {
        if (!hasCasinoAdmin(member)) {
          return interaction.reply({ content: "❌ אין לך הרשאה.", ephemeral: true });
        }

        const target = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");

        const t = ensureUser(target.id);
        if (sub === "addmoney") t.balance += amount;
        if (sub === "setmoney") t.balance = amount;
        setUser(target.id, t);

        await logCasino(
          client,
          interaction.guild,
          `🛠️ Admin Money | Admin: <@${userId}> | Target: <@${target.id}> | ${sub} ${formatMoney(amount)}`
        );

        return interaction.reply({
          content: `✅ בוצע. <@${target.id}> עכשיו עם ${formatMoney(t.balance)}`,
          ephemeral: true,
        });
      }

      // =====================
      // BET CHECK
      // =====================
      const bet = clampBet(interaction.options.getInteger("bet"));
      if (!bet) return interaction.reply({ content: "❌ סכום לא תקין.", ephemeral: true });

      if (bet > u.balance) {
        return interaction.reply({
          content: `❌ אין לך מספיק כסף.\nהיתרה שלך: **${formatMoney(u.balance)}**`,
          ephemeral: true,
        });
      }

      // =====================
      // COINFLIP
      // =====================
      if (sub === "coinflip") {
        const base = 0.5;
        const winChance = chance(base, luck);

        const win = rollWin(winChance);

        if (win) {
          u.balance += bet;
          u.wins++;
          setUser(userId, u);

          await logCasino(client, interaction.guild, `🪙 Coinflip WIN | <@${userId}> +${formatMoney(bet)}`);

          return interaction.reply(`🎉 ניצחת! +**${formatMoney(bet)}**\n💰 יתרה: **${formatMoney(u.balance)}**`);
        } else {
          u.balance -= bet;
          u.losses++;
          setUser(userId, u);

          await logCasino(client, interaction.guild, `🪙 Coinflip LOSE | <@${userId}> -${formatMoney(bet)}`);

          return interaction.reply(`💀 הפסדת: **${formatMoney(bet)}**\n💰 יתרה: **${formatMoney(u.balance)}**`);
        }
      }

      // =====================
      // SLOTS
      // =====================
      if (sub === "slots") {
        const symbols = ["🍒", "🍋", "🍇", "💎", "7️⃣"];
        const a = pick(symbols);
        const b = pick(symbols);
        const c = pick(symbols);

        let mult = 0;

        if (a === b && b === c) {
          if (a === "7️⃣") mult = 5;
          else if (a === "💎") mult = 4;
          else mult = 3;
        } else if (a === b || b === c || a === c) {
          mult = 1.5;
        }

        mult = mult * (1 + luck * 0.35);

        if (mult > 0) {
          const gain = Math.floor(bet * mult);
          u.balance += gain;
          u.wins++;
          setUser(userId, u);

          await logCasino(client, interaction.guild, `🎰 Slots WIN | <@${userId}> +${formatMoney(gain)}`);

          return interaction.reply(
            `🎰 ${a} ${b} ${c}\n🎉 ניצחת!\n🏆 רווח: **${formatMoney(gain)}**\n💰 יתרה: **${formatMoney(u.balance)}**`
          );
        } else {
          u.balance -= bet;
          u.losses++;
          setUser(userId, u);

          await logCasino(client, interaction.guild, `🎰 Slots LOSE | <@${userId}> -${formatMoney(bet)}`);

          return interaction.reply(
            `🎰 ${a} ${b} ${c}\n💀 הפסדת: **${formatMoney(bet)}**\n💰 יתרה: **${formatMoney(u.balance)}**`
          );
        }
      }

      // =====================
      // DICE
      // =====================
      if (sub === "dice") {
        const userRoll = randInt(1, 6);
        const botRoll = randInt(1, 6);

        // בסיס 48% כדי שלא יהיה שבור
        const winChance = chance(0.48, luck);

        const win = rollWin(winChance);

        if (win) {
          const gain = bet;
          u.balance += gain;
          u.wins++;
          setUser(userId, u);

          await logCasino(client, interaction.guild, `🎲 Dice WIN | <@${userId}> +${formatMoney(gain)}`);

          return interaction.reply(
            `🎲 אתה: **${userRoll}** | הבוט: **${botRoll}**\n🎉 ניצחת! +${formatMoney(
              gain
            )}\n💰 יתרה: **${formatMoney(u.balance)}**`
          );
        } else {
          u.balance -= bet;
          u.losses++;
          setUser(userId, u);

          await logCasino(client, interaction.guild, `🎲 Dice LOSE | <@${userId}> -${formatMoney(bet)}`);

          return interaction.reply(
            `🎲 אתה: **${userRoll}** | הבוט: **${botRoll}**\n💀 הפסדת: ${formatMoney(
              bet
            )}\n💰 יתרה: **${formatMoney(u.balance)}**`
          );
        }
      }

      // =====================
      // HIGHLOW
      // =====================
      if (sub === "highlow") {
        const pickSide = interaction.options.getString("pick");
        const num = randInt(1, 10);

        const isHigh = num >= 6;
        const win = (pickSide === "high" && isHigh) || (pickSide === "low" && !isHigh);

        // מזל נותן בונוס קטן
        const finalWin = win ? rollWin(chance(0.92, luck * 0.15)) : false;

        if (finalWin) {
          const gain = Math.floor(bet * 1.2);
          u.balance += gain;
          u.wins++;
          setUser(userId, u);

          await logCasino(client, interaction.guild, `📈 HighLow WIN | <@${userId}> +${formatMoney(gain)}`);

          return interaction.reply(
            `🎯 יצא: **${num}**\n🎉 צדקת! רווח: **${formatMoney(
              gain
            )}**\n💰 יתרה: **${formatMoney(u.balance)}**`
          );
        } else {
          u.balance -= bet;
          u.losses++;
          setUser(userId, u);

          await logCasino(client, interaction.guild, `📉 HighLow LOSE | <@${userId}> -${formatMoney(bet)}`);

          return interaction.reply(
            `🎯 יצא: **${num}**\n💀 טעית! הפסדת: **${formatMoney(
              bet
            )}**\n💰 יתרה: **${formatMoney(u.balance)}**`
          );
        }
      }

      // =====================
      // ROULETTE
      // =====================
      if (sub === "roulette") {
        const color = interaction.options.getString("color");

        // תוצאות: אדום 47%, שחור 47%, ירוק 6%
        const roll = Math.random();

        let result = "red";
        if (roll < 0.47) result = "red";
        else if (roll < 0.94) result = "black";
        else result = "green";

        let mult = 0;
        if (color === result) {
          if (result === "green") mult = 12;
          else mult = 2;
        }

        // מזל משפיע רק על אדום/שחור קצת
        if (result !== "green") mult = mult * (1 + luck * 0.15);

        if (mult > 0) {
          const gain = Math.floor(bet * mult);
          u.balance += gain;
          u.wins++;
          setUser(userId, u);

          await logCasino(client, interaction.guild, `🎡 Roulette WIN | <@${userId}> +${formatMoney(gain)}`);

          return interaction.reply(
            `🎡 יצא: **${result === "red" ? "🔴 אדום" : result === "black" ? "⚫ שחור" : "🟢 ירוק"}**\n` +
              `🎉 ניצחת! רווח: **${formatMoney(gain)}**\n💰 יתרה: **${formatMoney(u.balance)}**`
          );
        } else {
          u.balance -= bet;
          u.losses++;
          setUser(userId, u);

          await logCasino(client, interaction.guild, `🎡 Roulette LOSE | <@${userId}> -${formatMoney(bet)}`);

          return interaction.reply(
            `🎡 יצא: **${result === "red" ? "🔴 אדום" : result === "black" ? "⚫ שחור" : "🟢 ירוק"}**\n` +
              `💀 הפסדת: **${formatMoney(bet)}**\n💰 יתרה: **${formatMoney(u.balance)}**`
          );
        }
      }

      // =====================
      // BLACKJACK
      // =====================
      if (sub === "blackjack") {
        // דילר/שחקן
        const player = [drawCard(), drawCard()];
        const dealer = [drawCard(), drawCard()];

        const playerVal = handValue(player);
        const dealerVal = handValue(dealer);

        // סיכוי מושפע ממזל (קצת)
        const winChance = chance(0.42, luck * 0.35);
        const win = rollWin(winChance);

        if (win) {
          const mult = 2.0 + luck * 0.25;
          const gain = Math.floor(bet * mult);

          u.balance += gain;
          u.wins++;
          setUser(userId, u);

          await logCasino(client, interaction.guild, `🃏 Blackjack WIN | <@${userId}> +${formatMoney(gain)}`);

          return interaction.reply(
            `🃏 **BLACKJACK**\n\n` +
              `👤 אתה: ${showHand(player)} (**${playerVal}**)\n` +
              `🤵 דילר: ${showHand(dealer)} (**${dealerVal}**)\n\n` +
              `🎉 ניצחת! רווח: **${formatMoney(gain)}**\n💰 יתרה: **${formatMoney(u.balance)}**`
          );
        } else {
          u.balance -= bet;
          u.losses++;
          setUser(userId, u);

          await logCasino(client, interaction.guild, `🃏 Blackjack LOSE | <@${userId}> -${formatMoney(bet)}`);

          return interaction.reply(
            `🃏 **BLACKJACK**\n\n` +
              `👤 אתה: ${showHand(player)} (**${playerVal}**)\n` +
              `🤵 דילר: ${showHand(dealer)} (**${dealerVal}**)\n\n` +
              `💀 הפסדת: **${formatMoney(bet)}**\n💰 יתרה: **${formatMoney(u.balance)}**`
          );
        }
      }

      // =====================
      // CRASH
      // =====================
      if (sub === "crash") {
        // בסיס
        // מזל נותן בונוס קטן לסיכוי להגיע לx גבוה
        const baseCrash = 1.1 + Math.random() * 6.0;
        const boosted = baseCrash * (1 + luck * 0.25);

        // 30% לקרוס מוקדם
        const crashEarly = Math.random() < (0.30 - luck * 0.05);

        if (crashEarly) {
          u.balance -= bet;
          u.losses++;
          setUser(userId, u);

          await logCasino(client, interaction.guild, `📈 Crash LOSE | <@${userId}> -${formatMoney(bet)}`);

          return interaction.reply(
            `📈 **CRASH**\n💥 קרס ב־**x1.02**\n💀 הפסדת: **${formatMoney(bet)}**\n💰 יתרה: **${formatMoney(u.balance)}**`
          );
        } else {
          const mult = Math.min(12, Number(boosted.toFixed(2)));
          const gain = Math.floor(bet * mult);

          u.balance += gain;
          u.wins++;
          setUser(userId, u);

          await logCasino(client, interaction.guild, `📈 Crash WIN | <@${userId}> x${mult} +${formatMoney(gain)}`);

          return interaction.reply(
            `📈 **CRASH**\n🚀 הגיע ל־**x${mult}**\n🎉 רווח: **${formatMoney(
              gain
            )}**\n💰 יתרה: **${formatMoney(u.balance)}**`
          );
        }
      }
    } catch (err) {
      console.log("❌ Casino Mega error:", err);
      if (!interaction.replied) {
        return interaction.reply({ content: "❌ שגיאה בקזינו.", ephemeral: true }).catch(() => {});
      }
    }
  });
}

// =====================
// WEIGHTED PICK (WHEEL)
// =====================
function weightedPick(items, luck) {
  // luck מגדיל קצת את המשקל של הפרסים הגבוהים
  const scaled = items.map((x) => {
    let w = x.weight;

    // רק אם זה פרס גדול
    if (x.amount >= 2500) w = w * (1 + luck * 0.5);
    if (x.amount >= 10000) w = w * (1 + luck * 0.8);

    return { ...x, weight: w };
  });

  const total = scaled.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;

  for (const it of scaled) {
    r -= it.weight;
    if (r <= 0) return it;
  }

  return scaled[0];
}

module.exports = {
  registerCasinoSystem,
  buildCasinoSlash,
};
