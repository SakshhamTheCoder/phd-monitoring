// Reading a column out of an imported row by any of the names it goes by.
//
// The institute's spreadsheets use prose headers ("Registration Number", "Emp
// id") while the portal's own templates use snake_case, and people keep saved
// copies of both. Case, spaces and punctuation carry no meaning in a header, so
// they are stripped before comparing, which also covers the misspellings the
// source sheets ship with once the correct spelling is listed alongside.
const normalise = (header) => String(header ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// The value of the first alias the row has filled in, or ''. Aliases are tried
// in the order given, so a row carrying two spellings of the same column uses
// the one the caller named first.
export const column = (row, ...aliases) => {
  const values = {};
  for (const key of Object.keys(row || {})) {
    values[normalise(key)] = String(row[key] ?? '').trim();
  }

  for (const alias of aliases) {
    const value = values[normalise(alias)];
    if (value) return value;
  }

  return '';
};

export default column;
