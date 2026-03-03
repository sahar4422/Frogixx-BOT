require("dotenv").config();
const { REST, Routes } = require("discord.js");

const CLIENT_ID = "1470093391697023040";
const GUILD_ID = "1461671595075436728";

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("🧹 מוחק את כל הפקודות מהשרת...");

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: [],
    });

    console.log("✅ נמחקו כל הפקודות בהצלחה!");
  } catch (err) {
    console.error(err);
  }
})();
