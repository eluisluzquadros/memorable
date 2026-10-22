// Brand avatars use tones from the studio's world; legacy colours saved in older accounts map onto them.
export const BRAND_TONES = ["#8a6420", "#3f6b4f", "#6b4766", "#b4461a", "#8e3b3b", "#4a5560"];
const LEGACY = { "#214cff": "#8a6420", "#167154": "#3f6b4f", "#7852a5": "#6b4766", "#8c5700": "#b4461a", "#b14d42": "#8e3b3b", "#4b6076": "#4a5560" };
export const brandTone = (color, index = 0) => LEGACY[String(color || "").toLowerCase()] || color || BRAND_TONES[index % BRAND_TONES.length];
