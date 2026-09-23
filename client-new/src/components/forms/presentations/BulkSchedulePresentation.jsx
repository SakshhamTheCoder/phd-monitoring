import React, { useState, useEffect } from 'react';
import { useLoading } from '../../../context/LoadingContext';
import { baseURL } from '../../../api/urls';
import { customFetch } from '../../../api/base';
import CustomButton from '../fields/CustomButton';
import { toast } from 'react-toastify';
import GridContainer from '../fields/GridContainer';
import DropdownField from '../fields/DropdownField';

import { generateReportPeriods } from "../../../utils/semester";
import InputField from '../fields/InputField';
import { parseCsv } from '../../../utils/csv';
import '../../bulkImport/bulkPreview.css';

const BulkSchedulePresentation = ({semester_name}) => {
  const { setLoading } = useLoading();
  const [csvData, setCsvData] = useState([]);
  const [reportPeriods, setReportPeriods] = useState([]);
  const [body, setBody] = useState({});

  useEffect(() => {
    const periods = generateReportPeriods(1, 1, true);
    const formattedPeriods = periods.map((period) => ({
      value: period,
      title: period,
    }));
    setReportPeriods(formattedPeriods);
    setBody((prev) => ({ ...prev, period_of_report: semester_name }));
  }, [semester_name]);

  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Cleared once read, so picking the same file again after correcting it
    // still fires a change.
    e.target.value = '';

    file.text().then((text) => {
      const headers = [
        "Student's Roll Number",
        "Student's Name",
        "Broad Area",
        "Period of Report",
        'Date',
        'Time',
        'Additional Guest Email',
      ];
      const expectedColumns = headers.length;
      const rawData = parseCsv(text);

      const parsedData = [];
      let invalidRows = 0;

      rawData.forEach((rowArr, index) => {
        if (
          !rowArr ||
          rowArr.every((cell) => !cell || cell.toString().trim() === '')
        )
          return;

        // The sample file starts with this header row. Posted as a scholar, it
        // failed validation and took the whole batch down with it.
        if (String(rowArr[0]).trim() === headers[0]) return;

        if (rowArr.length !== expectedColumns) {
          invalidRows++;
          console.warn(`Invalid column count in row ${index + 1}`, rowArr);
          return;
        }

        const rowObj = {};
        headers.forEach((header, i) => {
          rowObj[header] = rowArr[i] || '';
        });

        let rawDate = rowObj['Date'];
        if (typeof rawDate === 'number') {
          const date = new Date((rawDate - 25569) * 86400 * 1000);
          rowObj['Date'] = formatDate(date);
        } else {
          const parsed = new Date(rawDate);
          if (Number.isNaN(parsed.getTime())) {
            invalidRows++;
            console.warn(`Invalid date in row ${index + 1}`, rowArr);
            return;
          }
          rowObj['Date'] = formatDate(parsed);
        }

        const raw = rowObj['Additional Guest Email'] || '';
        if (raw) {
          const emails = raw.split(',').map((email) => email.trim());
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const invalidEmails = emails.filter(
            (email) => !emailRegex.test(email)
          );

          if (invalidEmails.length > 0) {
            invalidRows++;
            console.warn(`Invalid emails in row ${index + 1}`, rowArr);
            rowObj['Additional Guest Email'] = [];
            return;
          } else {
            rowObj['Additional Guest Email'] = emails;
          }
        }

        parsedData.push(rowObj);
      });

      if (invalidRows > 0) {
        toast.warn(`${invalidRows} row(s) ignored due to errors`);
      }

      setCsvData(parsedData);
    });
  };

  const confirmBulkSchedule = () => {
    if (!body.period_of_report) {
      toast.warn("Please select a period of report before confirming.");
      return;
    }

    setLoading(true);

    const students = csvData.map((entry) => ({
      student_id: entry["Student's Roll Number"],
      date: entry['Date'],
      time: entry['Time'],
      period_of_report: entry['Period of Report'] || body.period_of_report,
      guest_emails: entry['Additional Guest Email'] || [],
    }));

    customFetch(
      baseURL + `/forms/presentation/semester/${semester_name}/bulk-schedule`,
      'POST',
      { semester: semester_name, students }
    )
      .then((data) => {
        if (data && data.success) {
          toast.success('Bulk Presentations Scheduled');
          // Drop the scheduled batch so Confirm goes away and cannot post it again.
          setCsvData([]);
        }
        setLoading(false);
      })
      .catch((error) => {
        toast.error('Error in scheduling bulk presentations ' + error);
        setLoading(false);
      });
  };

  const downloadSampleCSV = async () => {
    setLoading(true);
    try {
      // Get the current path to extract semester info
      const currentPath = window.location.pathname;
      const response = await customFetch(
        baseURL + currentPath + '/not-scheduled?page=1&rows=1000',
        'GET'
      );

      if (response?.success) {
        const students = response.response.data || [];
        
        // Create CSV content
        const headers = [
          "Student's Roll Number",
          "Student's Name",
          "Broad Area",
          "Period of Report",
          "Date",
          "Time",
          "Additional Guest Email"
        ];
        
        const rows = students.map(student => [
          student.roll_no || '',
          student.name || '',
          student.broad_area || '',
          semester_name || '',
          '', // Empty Date field for user to fill
          '', // Empty Time field for user to fill
          '' // Empty Additional Guest Email field for user to fill
        ]);

        // Combine headers and rows
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.map(cell => {
            // Escape cells containing commas or quotes
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          }).join(','))
        ].join('\n');

        // Create and download the file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = `bulk_schedule_${semester_name || 'presentation'}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        
        toast.success('Sample CSV downloaded successfully');
      } else {
        toast.error('Failed to fetch student data');
      }
    } catch (error) {
      console.error('Error downloading sample CSV:', error);
      toast.error('Error downloading sample CSV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <GridContainer
        elements={[
          <input
            type='file'
            accept='.csv'
            onChange={handleFileUpload}
            className="bulk-preview-file-plain"
          />,
          <CustomButton
            text='Sample CSV'
            variant='secondary'
            onClick={downloadSampleCSV}
          />,
        ]}
        space={2}
      />

      <GridContainer
        elements={[

          <InputField 
            label={"Period of report"}
            isLocked={true}
            initialValue={semester_name }
          />
        ]}
        space={2}
      />

      {csvData.length > 0 && (
        <>
          <div className="bulk-preview-heading bulk-preview-heading--tight">
            Selected period: {body.period_of_report}
          </div>
          <div className="bulk-preview-scroll bulk-preview-scroll--full">
            <table
              className="bulk-preview-table"
            >
              <thead
                className="bulk-preview-head"
              >
                <tr>
                  {Object.keys(csvData[0]).map((key) => (
                    <th
                      key={key}
                      className="bulk-preview-th"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.map((row, index) => (
                  <tr
                    key={index}
                    className="bulk-preview-row bulk-preview-row--hover"
                  >
                    {Object.values(row).map((value, idx) => (
                      <td
                        key={idx}
                        className="bulk-preview-cell"
                      >
                        {Array.isArray(value) ? value.join(', ') : value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bulk-preview-actions">
            <CustomButton
              text='Confirm bulk schedule'
              onClick={confirmBulkSchedule}
            />
          </div>
        </>
      )}
    </>
  );
};

export default BulkSchedulePresentation;
