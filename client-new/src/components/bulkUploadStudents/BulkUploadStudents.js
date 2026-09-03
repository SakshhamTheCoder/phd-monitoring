import React, { useState } from 'react';
import { useLoading } from '../../context/LoadingContext';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import CustomButton from '../forms/fields/CustomButton';
import { toast } from 'react-toastify';
import { read, utils } from 'xlsx';
import GridContainer from '../forms/fields/GridContainer';

const BulkUploadStudents = ({ onSuccess }) => {
  const { setLoading } = useLoading();
  const [csvData, setCsvData] = useState([]);

  const downloadSampleCSV = () => {
    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Roll Number",
      "Department Code",
      "Date of Registration (YYYY-MM-DD)",
      "Date of IRB (YYYY-MM-DD)",
      "PhD Title",
      "Father's Name",
      "Address",
      "Current Status",
      "CGPA",
      "Overall Progress"
    ];

    const sampleRow = [
      "John",
      "Doe",
      "john.doe@example.com",
      "+1234567890",
      "PHD2024001",
      "CSED",
      "2024-01-15",
      "2024-03-20",
      "Machine Learning Applications in Healthcare",
      "Michael Doe",
      "123 Main Street, City",
      "full-time",
      "3.85",
      "25.5"
    ];

    const csvContent = [
      headers.join(','),
      sampleRow.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = 'bulk_upload_students_sample.csv';
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('Sample CSV downloaded successfully');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const headers = [
        "First Name",
        "Last Name",
        "Email",
        "Phone",
        "Roll Number",
        "Department Code",
        "Date of Registration (YYYY-MM-DD)",
        "Date of IRB (YYYY-MM-DD)",
        "PhD Title",
        "Father's Name",
        "Address",
        "Current Status",
        "CGPA",
        "Overall Progress"
      ];
      
      const expectedColumns = headers.length;
      const rawData = utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

      const parsedData = [];
      let invalidRows = 0;

      // Helper function to format dates from Excel
      const formatDate = (value) => {
        if (!value || value === '') return '';
        
        // If it's already in YYYY-MM-DD format, return it
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return value;
        }
        
        // If it's a Date object
        if (value instanceof Date) {
          const year = value.getFullYear();
          const month = String(value.getMonth() + 1).padStart(2, '0');
          const day = String(value.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        
        // If it's an Excel serial number
        if (typeof value === 'number' && value > 1000) {
          const date = new Date((value - 25569) * 86400 * 1000);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        
        return value;
      };

      rawData.forEach((rowArr, index) => {
        if (index === 0) return; // Skip header row
        
        if (!rowArr || rowArr.every((cell) => !cell || cell.toString().trim() === '')) {
          return;
        }

        if (rowArr.length !== expectedColumns) {
          invalidRows++;
          console.warn(`Invalid column count in row ${index + 1}`, rowArr);
          return;
        }

        const rowObj = {};
        headers.forEach((header, i) => {
          let value = rowArr[i] || '';
          
          // Format date fields
          if (header === 'Date of Registration (YYYY-MM-DD)' || header === 'Date of IRB (YYYY-MM-DD)') {
            value = formatDate(value);
          }
          
          rowObj[header] = value;
        });

        // Handle Last Name - if empty, set to space
        if (!rowObj['Last Name'] || rowObj['Last Name'].trim() === '') {
          rowObj['Last Name'] = ' ';
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (rowObj['Email'] && !emailRegex.test(rowObj['Email'])) {
          invalidRows++;
          console.warn(`Invalid email in row ${index + 1}`, rowArr);
          toast.error(`Row ${index + 1}: Invalid email format`);
          return;
        }

        // For unified create-or-update, only Email is mandatory; other fields optional for updates
        if (!rowObj['Email'] || rowObj['Email'].trim() === '') {
          invalidRows++;
          toast.error(`Row ${index + 1}: Missing Email`);
          return;
        }

        // Validate current_status values
        const validStatuses = ['part-time', 'full-time', 'executive'];
        if (rowObj['Current Status'] && !validStatuses.includes(rowObj['Current Status'].toLowerCase())) {
          invalidRows++;
          console.warn(`Invalid current status in row ${index + 1}`, rowArr);
          toast.error(`Row ${index + 1}: Current Status must be one of: part-time, full-time, executive`);
          return;
        }

        parsedData.push(rowObj);
      });

      if (invalidRows > 0) {
        toast.warn(`${invalidRows} row(s) ignored due to errors`);
      }

      if (parsedData.length === 0) {
        toast.error('No valid rows found in CSV');
        return;
      }

      setCsvData(parsedData);
      toast.success(`Loaded ${parsedData.length} student(s) from CSV`);
    };

    reader.readAsArrayBuffer(file);
  };

  const confirmBulkUpload = () => {
    if (csvData.length === 0) {
      toast.warn("Please upload a CSV file before confirming.");
      return;
    }

    setLoading(true);

    const students = csvData.map((entry) => ({
      first_name: entry['First Name'],
      last_name: entry['Last Name'],
      email: entry['Email'],
      phone: entry['Phone'],
      roll_no: entry['Roll Number'],
      department_code: entry['Department Code'],
      date_of_registration: entry['Date of Registration (YYYY-MM-DD)'],
      date_of_irb: entry['Date of IRB (YYYY-MM-DD)'] || null,
      phd_title: entry['PhD Title'] || null,
      fathers_name: entry["Father's Name"] || null,
      address: entry['Address'] || null,
      current_status: entry['Current Status'],
      cgpa: entry['CGPA'] || null,
      overall_progress: entry['Overall Progress'] || 0
    }));

    const endpoint = '/students/bulk-upload';
    customFetch(baseURL + endpoint, 'POST', { students })
      .then((data) => {
        if (data && data.success) {
          const d = data.response.data || {};
          const sc = d.success_count ?? data.response.successful ?? 0;
          const uc = d.update_count ?? 0;
          const ec = d.error_count ?? data.response.failed ?? 0;
          toast.success(`Successfully uploaded ${sc + uc} student(s) (${sc} created, ${uc} updated) — creates or updates by email/roll`);
          if (ec > 0) {
            toast.warn(`${ec} student(s) failed`);
            if (d.errors || data.response.errors) console.error('Upload errors:', d.errors || data.response.errors);
          }
          setCsvData([]);
          if (onSuccess) onSuccess();
        }
        setLoading(false);
      })
      .catch((error) => {
        toast.error('Error in bulk upload: ' + error);
        setLoading(false);
      });
  };

  return (
    <div style={{ padding: '20px' }}>
      <h3>Bulk Import Students</h3>
      <p style={{ marginBottom: '10px' }}>Upload a CSV to add or update students (matched by email or roll number). Only provided columns are updated for existing records.</p>
      <div style={{ 
        backgroundColor: '#f0f7ff', 
        border: '1px solid #2196F3', 
        borderRadius: '6px', 
        padding: '12px', 
        marginBottom: '20px',
        fontSize: '14px'
      }}>
        <strong>Required fields:</strong> First Name, Email, Phone, Roll Number, Department Code, Date of Registration, Current Status<br/>
        <strong>Optional fields:</strong> Last Name, Date of IRB, PhD Title, Father's Name, Address, CGPA, Overall Progress<br/>
        <strong>Current Status values:</strong> part-time, full-time, executive
      </div>
      
      <GridContainer
        elements={[
          <input
            type='file'
            accept='.csv'
            onChange={handleFileUpload}
            style={{ 
              marginTop: '10px',
              padding: '8px',
              border: '2px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          />,
          <CustomButton
            text='Download Sample CSV'
            onClick={downloadSampleCSV}
            style={{
              backgroundColor: '#FF9800',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              fontWeight: '500'
            }}
          />,
        ]}
        space={2}
      />

      {csvData.length > 0 && (
        <>
          <div style={{ marginTop: '20px', fontWeight: 'bold' }}>
            {csvData.length} student(s) ready to upload
          </div>
          
          <div style={{ overflowX: 'auto', marginTop: '16px', maxHeight: '400px', overflowY: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontFamily: 'Arial, sans-serif',
                fontSize: '14px',
                backgroundColor: '#fff',
                boxShadow: '0 0 10px rgba(0,0,0,0.1)',
              }}
            >
              <thead
                style={{
                  backgroundColor: '#f5f5f5',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}
              >
                <tr>
                  {Object.keys(csvData[0]).map((key) => (
                    <th
                      key={key}
                      style={{
                        border: '1px solid #ccc',
                        padding: '10px',
                        fontWeight: '600',
                        textAlign: 'left',
                        color: '#333',
                        whiteSpace: 'nowrap',
                      }}
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
                    style={{
                      borderBottom: '1px solid #eee',
                      backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9',
                    }}
                  >
                    {Object.values(row).map((value, idx) => (
                      <td
                        key={idx}
                        style={{
                          padding: '10px',
                          border: '1px solid #ddd',
                          color: '#444',
                        }}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '16px', textAlign: 'right' }}>
            <CustomButton
              text="Confirm Bulk Import"
              onClick={confirmBulkUpload}
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '16px'
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default BulkUploadStudents;
