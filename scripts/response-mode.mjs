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

// A view of observed preferences, never a writer or a claim of hook activation.
export function responseGuidance({characterLimitEnabled,expanded=false,presentation}={}) {
  const mode=presentation==='project'?'project':typeof characterLimitEnabled!=='boolean'?'unverified':!characterLimitEnabled?'unlimited':expanded?'expanded':'concise';
  return {mode,footer:mode==='concise'?'Say expand for more detail once, or limit off to allow longer replies in this chat. Use limit on to bring back short replies.':null,
    controls:mode==='project'?null:{expand:'One response; send expand as its own message.',off:'limit off',on:'limit on',status:'limit status'},
    note:'Length preference only; workflow and evidence requirements remain. Unknown state is not a preference change.'};
}
