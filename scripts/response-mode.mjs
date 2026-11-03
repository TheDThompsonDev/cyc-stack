// Only explicit, standalone user commands change a persistent preference.
export function lengthCommand(prompt) {
  const text = prompt.trim();
  const short = /^(?:limit|\/cyc-limit)\s+(on|off|status)[.!]?$/i.exec(text);
  if (short) return short[1].toLowerCase();
  const natural = /^(?:please\s+)?turn\s+(on|off)\s+(?:the\s+)?(?:1,?000|thousand)[ -]character\s+limit[.!]?$/i.exec(text);
  return natural?.[1].toLowerCase() ?? null;
}

export function allowsLongResponse(state) {
  return state.characterLimitEnabled === false || state.expanded === true;
}
