const selectors = {
  'assignment-list': assignments => assignments.map(item => ({ ...item })),
  'active-list': assignments => assignments.map(item => ({ ...item })),
  'remaining-count': assignments => assignments.length,
};

export function selectView(name, assignments) {
  const selector = selectors[name];
  if (!selector) throw new Error(`Unknown view: ${name}`);
  return selector(assignments);
}
