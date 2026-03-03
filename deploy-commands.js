require("dotenv").config();

const { REST, Routes } = require("discord.js");

// פקודות
const { buildGiveawaySlash } = require("./giveaways");
const { buildCasinoSlash } = require("./casino");

// IDs
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// כל הפקודות שאתה רוצה בשרת
const commands = [
  buildGiveawaySlash().toJSON(),
  buildCasinoSlash().toJSON(),
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("🧹 מוחק פקודות ישנות ומעלה חדשות...");

    // מוחק את כל הפקודות הישנות של השרת
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: [],
    });

    console.log("✅ נמחקו כל הפקודות הישנות!");

    // מעלה מחדש את כל הפקודות
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });

    console.log("✅ כל הפקודות עלו מחדש בהצלחה!");
  } catch (error) {
    console.error("❌ שגיאה בהעלאת פקודות:", error);
  }
})();
