// Deciding which author in a publication is the person whose profile you are
// looking at.
//
// Scopus and ORCID return abbreviated authors — "Bhatia T.", "T. Bhatia",
// sometimes just "Bhatia" — never the full name stored on the profile. Matching
// the profile name against the string therefore found nothing, and no author was
// ever highlighted.
//
// So compare on what an abbreviation does preserve: the surname, plus a given
// name or first initial whenever the entry offers one. Requiring that agreement
// is what stops a same-surname co-author ("Bhatia S.") from being mistaken for
// the profile owner.

const HONORIFICS = ['dr', 'prof', 'mr', 'mrs', 'ms', 'er'];

// Letters only, lowercased, honorifics dropped. Punctuation becomes a separator
// so "A.K." reads as two initials rather than one token.
export const nameTokens = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z\s]/g, ' ')
  .split(/\s+/)
  .filter((t) => t && !HONORIFICS.includes(t));

// The profile name's surname and given names. Assumes the surname is last, which
// is how the portal stores faculty names.
export const profileIdentity = (name) => {
  const toks = nameTokens(name);
  if (!toks.length) return null;
  const given = toks.slice(0, -1);
  return { surname: toks[toks.length - 1], given, initial: given.length ? given[0][0] : '' };
};

export const isProfileAuthor = (entry, id) => {
  if (!id) return false;
  const toks = nameTokens(entry);
  if (!toks.length) return false;
  const words = toks.filter((t) => t.length > 1);
  const initials = toks.filter((t) => t.length === 1);
  if (!words.includes(id.surname)) return false;

  const others = words.filter((t) => t !== id.surname);
  // A spelled-out given name has to be one of the profile's.
  if (others.some((t) => id.given.includes(t))) return true;
  // Otherwise an initial has to match the profile's first initial.
  if (id.initial && initials.includes(id.initial)) return true;
  // A bare surname carries nothing that could contradict, so take it.
  return others.length === 0 && initials.length === 0;
};

// Split an author list into entries while keeping the separators, so the line
// renders exactly as the source string reads.
export const splitAuthors = (authors) => String(authors).split(/([,;&]|\sand\s)/i);
