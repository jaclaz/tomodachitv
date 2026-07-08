// Lightweight blocklist for usernames and display names.
// Covers common English + Italian slurs and hateful terms.
// Not exhaustive — the moderation system + report flow are the second line of defense.

const BLOCKED_TERMS = [
  // Racial / ethnic slurs (EN)
  "nigger", "nigga", "n1gger", "n1gga", "chink", "gook", "spic", "kike",
  "wetback", "beaner", "coon", "jigaboo", "pickaninny", "sandnigger",
  // Racial / ethnic slurs (IT)
  "negro", "negra", "negri", "sporconegro", "muso giallo", "musogiallo",
  "crucco", "terrone", "polentone", "marocchino di merda", "zingaro di merda",
  // Homophobic / transphobic slurs
  "faggot", "fag", "f4ggot", "tranny", "dyke", "shemale",
  "frocio", "froci", "ricchione", "checca", "finocchio", "finocchi",
  // Antisemitic / nazi
  "hitler", "heilhitler", "sieghail", "seighail", "nazi", "kkk",
  "gaskike", "gasjews", "1488", "88hh", "auschwitz",
  // Ableist
  "retard", "retarded", "r3tard", "mongoloid", "handicappato di merda",
  // Sexual / explicit
  "rapist", "pedo", "pedophile", "childporn", "cp",
  "stupratore", "pedofilo",
  // Generic hate combos
  "killjews", "killblacks", "killgays", "killmuslims",
  "ammazzaebrei", "ammazzanegri", "ammazzagay",
];

// Also block obvious admin/system impersonation.
const RESERVED = [
  "admin", "administrator", "root", "system", "support", "moderator", "mod",
  "staff", "tomodachi", "tomodachitv", "official", "help", "owner",
];

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/\$/g, "s")
    .replace(/@/g, "a")
    .replace(/[^a-z\s]/g, ""); // keep only letters + spaces
}

export type ProfanityCheck =
  | { ok: true }
  | { ok: false; reason: "offensive" | "reserved" };

export function checkNameSafety(input: string): ProfanityCheck {
  const raw = input.trim();
  if (!raw) return { ok: true };
  const normalized = normalize(raw);
  const collapsed = normalized.replace(/\s+/g, "");

  for (const term of RESERVED) {
    if (collapsed === term) return { ok: false, reason: "reserved" };
  }
  for (const term of BLOCKED_TERMS) {
    const t = term.replace(/\s+/g, "");
    if (collapsed.includes(t)) return { ok: false, reason: "offensive" };
  }
  return { ok: true };
}

export function nameSafetyMessage(reason: "offensive" | "reserved"): string {
  if (reason === "reserved") {
    return "That name is reserved. Please choose another.";
  }
  return "That name contains language that isn't allowed. Please choose another.";
}
