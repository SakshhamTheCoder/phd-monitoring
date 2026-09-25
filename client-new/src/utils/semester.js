// Semester codes around today, such as 2526ODD. An academic year runs July to
// June and is odd until December. Terms are counted in a row (year * 2, plus
// one for the even term), so stepping back from an even term lands on the odd
// term of the same year. The server's ReportPeriods does the same.
export function generateReportPeriods(next, prev, includeCurrent = true) {
    const periods = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const isEvenSemester = currentDate.getMonth() + 1 <= 6;
    const academicStartYear = isEvenSemester ? currentYear - 1 : currentYear;
    const currentTerm = academicStartYear * 2 + (isEvenSemester ? 1 : 0);

    let baseIndex = 0; // 0 means current semester
    if (!includeCurrent) baseIndex = isEvenSemester ? -1 : -2;

    for (let i = -prev; i <= next; i++) {
        const term = currentTerm + baseIndex + i;
        const startYear = ((Math.floor(term / 2) % 100) + 100) % 100;
        const endYear = (startYear + 1) % 100;
        const even = ((term % 2) + 2) % 2 === 1;
        periods.push(`${String(startYear).padStart(2, '0')}${String(endYear).padStart(2, '0')}${even ? 'EVEN' : 'ODD'}`);
    }

    return periods;
}
