// ================================
// Nicknames System (By Roles)
// Option 1: Highest role wins (לפי סדר הרשימה)
// ================================

const ROLE_NICKNAME_RULES = [
  // ====== TOP (הכי גבוה) ======
  { roleId: "1461677799311016000", prefix: "◈ OW | " }, // OWNER
  { roleId: "1461677804557959198", prefix: "◈ CO | " }, // Co Owner
  { roleId: "1462457760460439796", prefix: "◈ SMG | " }, // Senior Management
  { roleId: "1462789004968595591", prefix: "◈ MG | " }, // MANAGEMENT
  { roleId: "1462450141989437552", prefix: "◈ DEV | " }, // Developer
  { roleId: "1462789392392257667", prefix: "◈ AR | " }, // Advisor
  { roleId: "1462789428861862021", prefix: "◈ SAD | " }, // Senior Admin
  { roleId: "1462789562756628520", prefix: "◈ AD | " }, // Admin
  { roleId: "1468948875342778454", prefix: "◈ INS | " }, // Inspector
  { roleId: "1469797355887792374", prefix: "◈ STM | " }, // Staff Manager
  { roleId: "1462791791702048924", prefix: "◈ SMOD | " }, // senior moderators
  { roleId: "1462792305026269450", prefix: "◈ MOD | " }, // Moderator
  { roleId: "1462792395933352048", prefix: "◈ GR | " }, // Guardian
  { roleId: "1462792498161389601", prefix: "◈ HR | " }, // Helper

  // ====== MIDDLE MAN ======
  { roleId: "1462843169505935524", prefix: "◈ MM | " }, // roblox manger
  { roleId: "1467260702153769083", prefix: "◈ MM | " }, // Middle Man [A]
  { roleId: "1462797599454003326", prefix: "◈ MM | " }, // Middle Man [B]
  { roleId: "1462844488580993075", prefix: "◈ MM | " }, // Middle Man [C]
  { roleId: "1462798053726617740", prefix: "◈ MM | " }, // Middle Man

  // ====== OTHER ======
  { roleId: "1463577587761680559", prefix: "◈ CC | " }, // Content Creator
  { roleId: "1463547409874550978", prefix: "◈ REP | " }, // Respect People
  { roleId: "1463552970108047390", prefix: "◈ VIP | " }, // VIP
  { roleId: "1465408461419577436", prefix: "◈ FR | " }, // Friends
  { roleId: "1463577879139975179", prefix: "◈ LIVE | " }, // Live Access
];

// שומר "שם בסיס" לכל משתמש כדי להחזיר אם יורדים מהרולים
// נשמר לקובץ כדי שגם אחרי כיבוי הבוט זה לא ילך לאיבוד
const fs = require("fs");
const ORIGINAL_NAMES_FILE = "./original_names.json";
let originalNames = {};

function loadOriginalNames() {
  try {
    if (!fs.existsSync(ORIGINAL_NAMES_FILE)) return;
    originalNames = JSON.parse(fs.readFileSync(ORIGINAL_NAMES_FILE, "utf8"));
  } catch {
    originalNames = {};
  }
}

function saveOriginalNames() {
  try {
    fs.writeFileSync(ORIGINAL_NAMES_FILE, JSON.stringify(originalNames, null, 2), "utf8");
  } catch {}
}

function getBaseName(member) {
  return member.displayName;
}

function removeAllPrefixes(name) {
  let result = name;

  for (const rule of ROLE_NICKNAME_RULES) {
    if (result.startsWith(rule.prefix)) {
      result = result.replace(rule.prefix, "");
    }
  }

  return result.trim();
}

function getHighestMatchingRule(member) {
  // לפי הסדר ברשימה - הראשון שנמצא הוא הכי גבוה
  for (const rule of ROLE_NICKNAME_RULES) {
    if (member.roles.cache.has(rule.roleId)) return rule;
  }
  return null;
}

async function applyNickname(member) {
  // אם אי אפשר לשנות (הרול של הבוט נמוך / אין הרשאות)
  if (!member.manageable) return;

  const rule = getHighestMatchingRule(member);

  // אם אין רול מתאים -> מחזיר לשם המקורי אם שמור
  if (!rule) {
    const saved = originalNames[member.id];
    if (!saved) return;

    // מחזיר רק אם באמת יש כרגע תג
    const current = member.nickname || "";
    const cleaned = removeAllPrefixes(current);

    // אם אין ניק, לא צריך
    if (!current) return;

    // אם הניק כבר אותו דבר, לא צריך
    if (current === saved || cleaned === saved) {
      // מחזיר לשם נקי בלי תג
      await member.setNickname(saved).catch(() => {});
      delete originalNames[member.id];
      saveOriginalNames();
      return;
    }

    await member.setNickname(saved).catch(() => {});
    delete originalNames[member.id];
    saveOriginalNames();
    return;
  }

  // יש רול מתאים
  const currentName = getBaseName(member);
  const baseName = removeAllPrefixes(currentName);

  // שומרים שם בסיס רק פעם אחת
  if (!originalNames[member.id]) {
    originalNames[member.id] = baseName;
    saveOriginalNames();
  }

  let newNick = `${rule.prefix}${baseName}`;

  // Discord מגביל ניק ל-32 תווים
  newNick = newNick.slice(0, 32);

  // אם כבר אותו ניק - לא עושים כלום
  if ((member.nickname || "") === newNick) return;

  await member.setNickname(newNick).catch(() => {});
}

function registerNicknameSystem(client) {
  loadOriginalNames();

  client.once("ready", () => {
    console.log("מערכת Nicknames לפי רולים נטענה!");
  });

  // שינוי רולים
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
      // אם אין שינוי ברולים -> לא צריך
      if (oldMember.roles.cache.size === newMember.roles.cache.size) return;

      await applyNickname(newMember);
    } catch {}
  });

  // אם מישהו נכנס (נדיר שיש לו רול ישר אבל אפשר)
  client.on("guildMemberAdd", async (member) => {
    try {
      await applyNickname(member);
    } catch {}
  });
}

module.exports = { registerNicknameSystem };
