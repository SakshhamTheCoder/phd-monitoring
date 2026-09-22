/**
 * A whole CSV file into rows of cells.
 *
 * Splitting on newlines first and parsing each line looks equivalent and is
 * not: a quoted cell may hold a newline, and every one of the institute's
 * sheets does somewhere. The faculty sheet has four, the students sheet two.
 * Each tore one row into two, and because the halves carried no email the
 * server refused the whole batch of fifty they sat in, losing 150 rows of a
 * 568 row file with nothing on screen to say so.
 */
export const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const character = text[i];

    if (quoted) {
      if (character === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows
    .map((cells) => cells.map((value) => value.trim()))
    .filter((cells) => cells.some((value) => value !== ''));
};
