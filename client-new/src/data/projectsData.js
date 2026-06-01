// ============================================================
// Projects Module — Dummy Data & Helpers
// ============================================================

export const categoryOptions = [
  'In-house', 'Research', 'Consultancy', 'Industry', 'International', 'Other'
];

export const fundingAgencies = [
  'DST', 'SERB', 'DRDO', 'ISRO', 'AICTE', 'UGC', 'CSIR', 'DBT',
  'TIET Seed Grant', 'Industry Partner', 'UNESCO', 'International Agency'
];

export const statusOptions = ['Active', 'Completed', 'Pending', 'On Hold'];

export const milestoneStatusOptions = ['Not Started', 'In Progress', 'Completed', 'Delayed'];

export const positionTypes = [
  'JRF', 'SRF', 'Research Associate', 'Research Intern', 'UG Intern', 'PG Intern'
];

export const budgetHeadTemplate = [
  { head: 'Manpower', subItems: ['PhD Scholar', 'JRF', 'SRF', 'Intern'] },
  { head: 'Travel', subItems: ['Domestic', 'International'] },
  { head: 'Equipment', subItems: ['Laptop', 'Smartphone', 'Sensors', 'Printer'] },
  { head: 'Contingency', subItems: [] },
  { head: 'Overhead', subItems: [] },
];

export const facultyPI = {
  name: 'Dr. Manpreet Kaur',
  department: 'Computer Science & Engineering',
  designation: 'Associate Professor',
  dateOfJoining: '2015-07-15',
  email: 'manpreet.kaur@thapar.edu',
  phone: '+91-175-2393000',
};

export const internalFacultyList = [
  { id: 'f1', name: 'Dr. Amit Sharma', department: 'Computer Science & Engineering', designation: 'Professor' },
  { id: 'f2', name: 'Dr. Neha Gupta', department: 'Electronics & Communication', designation: 'Associate Professor' },
  { id: 'f3', name: 'Dr. Rajesh Kumar', department: 'Mechanical Engineering', designation: 'Assistant Professor' },
  { id: 'f4', name: 'Dr. Priya Singh', department: 'Electrical Engineering', designation: 'Professor' },
  { id: 'f5', name: 'Dr. Vikram Patel', department: 'Civil Engineering', designation: 'Associate Professor' },
  { id: 'f6', name: 'Dr. Sunita Rani', department: 'Biotechnology', designation: 'Assistant Professor' },
];

export const sampleProjects = [
  {
    id: 'TIET-RD-2024-042',
    title: 'Neural Architecture Search for High-Performance Distributed Systems in Edge Computing',
    category: 'Research',
    fundingAgency: 'SERB, Govt. of India',
    amount: 4850000,
    tietShare: 3200000,
    role: 'PI',
    status: 'Active',
    startDate: '2023-10-01',
    endDate: '2026-10-01',
    durationYears: 3,
    durationMonths: 0,
    description: 'The proliferation of Edge Computing necessitates efficient deep learning models that can operate under extreme resource constraints. Traditional Neural Architecture Search (NAS) is computationally expensive and often results in models too large for edge deployment. This project proposes a revolutionary approach to NAS that utilizes reinforcement learning and differentiable search spaces to discover optimal architectures in a fraction of the time.',
    focusArea: 'AI/ML & IoT',
    grantType: 'CRG (Core Research Grant)',
    pi: { ...facultyPI },
    coPIs: [
      { type: 'internal', name: 'Dr. Amit Sharma', department: 'Computer Science & Engineering', designation: 'Professor' },
      { type: 'external', name: 'Dr. Robert Chen', designation: 'Senior Researcher', institute: 'MIT CSAIL', email: 'rchen@mit.edu', mobile: '+1-617-555-0123', website: 'https://rchen.mit.edu' }
    ],
    objectives: [
      { title: 'Lightweight NAS Framework', description: 'Design a lightweight NAS framework specifically tailored for heterogeneous edge devices with limited memory.' },
      { title: 'Multi-Objective Optimization', description: 'Develop a multi-objective optimization algorithm considering latency, energy consumption, and accuracy.' },
      { title: 'Real-World Validation', description: 'Validate the framework on real-world industrial IoT datasets and drone-based surveillance networks.' },
      { title: 'Publication & Open Source', description: 'Publish findings in high-impact SCI journals and open-source the codebase for the academic community.' },
    ],
    milestones: [
      { name: 'Literature Review', deliverable: 'Comprehensive Bibliography & Review Paper', dueDate: '2024-03-15', status: 'Completed' },
      { name: 'Algorithm Design', deliverable: 'NAS Algorithm Implementation', dueDate: '2024-09-30', status: 'Completed' },
      { name: 'Prototype Development', deliverable: 'Working Edge Deployment Prototype', dueDate: '2025-06-30', status: 'In Progress' },
      { name: 'Testing & Validation', deliverable: 'Benchmark Results & Analysis Report', dueDate: '2025-12-31', status: 'Not Started' },
      { name: 'Publication', deliverable: 'SCI Journal Paper Submission', dueDate: '2026-06-30', status: 'Not Started' },
    ],
    budget: {
      year1: { Manpower: 500000, Travel: 150000, Equipment: 800000, Contingency: 100000, Overhead: 50000 },
      year2: { Manpower: 600000, Travel: 200000, Equipment: 300000, Contingency: 150000, Overhead: 50000 },
      year3: { Manpower: 600000, Travel: 250000, Equipment: 0, Contingency: 100000, Overhead: 50000 },
    },
    equipmentDetails: [
      { item: 'GPU Workstation (NVIDIA A100)', amount: 650000 },
      { item: 'Edge Devices (Jetson Nano x5)', amount: 100000 },
      { item: 'Laptop (Development)', amount: 85000 },
    ],
    sanctionLetterLink: '#',
    documents: [
      { name: 'Sanction Letter', type: 'PDF', date: '2023-09-15' },
      { name: 'Project Proposal', type: 'PDF', date: '2023-06-20' },
      { name: 'Year 1 Progress Report', type: 'PDF', date: '2024-10-01' },
    ],
    positions: [
      { type: 'JRF', title: 'Junior Research Fellow — NAS Project', openings: 1, stipend: '₹31,000/month', deadline: '2025-08-15', applicants: 24, shortlisted: 5 },
    ],
  },
  {
    id: 'TIET-CS-2023-018',
    title: 'Optimizing Urban Logistics using Multi-Agent Reinforcement Learning',
    category: 'Consultancy',
    fundingAgency: 'LogiTech Solutions Inc.',
    amount: 4550000,
    tietShare: 4550000,
    role: 'Co-PI',
    status: 'Completed',
    startDate: '2022-01-15',
    endDate: '2023-12-31',
    durationYears: 2,
    durationMonths: 0,
    description: 'Industry consultancy project to optimize last-mile delivery routing for LogiTech Solutions using multi-agent reinforcement learning. Developed a real-time routing engine handling 10,000+ daily deliveries.',
    focusArea: 'AI/ML & Operations Research',
    grantType: 'Consultancy',
    pi: { name: 'Dr. Amit Sharma', department: 'Computer Science & Engineering', designation: 'Professor' },
    coPIs: [{ type: 'internal', ...facultyPI }],
    objectives: [
      { title: 'Route Optimization', description: 'Develop MARL-based dynamic routing for urban logistics.' },
      { title: 'Scalability Testing', description: 'Validate system at 10,000+ deliveries per day scale.' },
    ],
    milestones: [
      { name: 'Requirements Analysis', deliverable: 'System Requirements Document', dueDate: '2022-04-01', status: 'Completed' },
      { name: 'Algorithm Development', deliverable: 'MARL Engine v1.0', dueDate: '2022-10-01', status: 'Completed' },
      { name: 'Deployment', deliverable: 'Production API', dueDate: '2023-06-01', status: 'Completed' },
      { name: 'Final Report', deliverable: 'Project Completion Report', dueDate: '2023-12-15', status: 'Completed' },
    ],
    budget: {
      year1: { Manpower: 800000, Travel: 100000, Equipment: 500000, Contingency: 200000, Overhead: 150000 },
      year2: { Manpower: 900000, Travel: 150000, Equipment: 200000, Contingency: 300000, Overhead: 250000 },
    },
    equipmentDetails: [],
    sanctionLetterLink: '#',
    documents: [{ name: 'Contract Agreement', type: 'PDF', date: '2022-01-10' }],
    positions: [],
  },
  {
    id: 'INTL-ENE-2024-001',
    title: 'Global Green Hydrogen Research Initiative Phase II',
    category: 'International',
    fundingAgency: 'UNESCO - Clean Tech',
    amount: 24000000,
    tietShare: 8000000,
    role: 'Technical Advisor',
    status: 'Active',
    startDate: '2024-01-01',
    endDate: '2027-01-01',
    durationYears: 3,
    durationMonths: 0,
    description: 'International collaborative research on green hydrogen production using advanced electrolysis techniques and solar-powered systems.',
    focusArea: 'Renewable Energy',
    grantType: 'International Collaboration',
    pi: { name: 'Dr. Elena Volkov', department: 'Energy Sciences', designation: 'Professor', institute: 'ETH Zurich' },
    coPIs: [{ type: 'internal', ...facultyPI }],
    objectives: [
      { title: 'Advanced Electrolysis', description: 'Develop next-generation PEM electrolysis cells with 90%+ efficiency.' },
      { title: 'Solar Integration', description: 'Design integrated solar-hydrogen production systems.' },
    ],
    milestones: [
      { name: 'Phase II Kickoff', deliverable: 'Research Plan Document', dueDate: '2024-03-01', status: 'Completed' },
      { name: 'Cell Design', deliverable: 'PEM Cell Prototype', dueDate: '2025-06-01', status: 'In Progress' },
      { name: 'Field Testing', deliverable: 'Pilot Plant Data', dueDate: '2026-06-01', status: 'Not Started' },
    ],
    budget: {
      year1: { Manpower: 2000000, Travel: 500000, Equipment: 3000000, Contingency: 300000, Overhead: 200000 },
      year2: { Manpower: 2500000, Travel: 600000, Equipment: 2000000, Contingency: 400000, Overhead: 200000 },
      year3: { Manpower: 3000000, Travel: 800000, Equipment: 1000000, Contingency: 500000, Overhead: 200000 },
    },
    equipmentDetails: [{ item: 'PEM Electrolysis Stack', amount: 2500000 }],
    sanctionLetterLink: '#',
    documents: [],
    positions: [],
  },
  {
    id: 'TIET-EE-2024-092',
    title: 'Development of Low-Cost IoT Sensors for Smart Irrigation',
    category: 'In-house',
    fundingAgency: 'TIET Seed Grant',
    amount: 1200000,
    tietShare: 1200000,
    role: 'Lead Researcher',
    status: 'Pending',
    startDate: '2024-07-01',
    endDate: '2025-12-31',
    durationYears: 1,
    durationMonths: 6,
    description: 'In-house project to develop affordable IoT-based soil moisture and weather sensors for precision agriculture in Punjab region.',
    focusArea: 'IoT & Agriculture',
    grantType: 'Seed Grant',
    pi: { ...facultyPI },
    coPIs: [],
    objectives: [
      { title: 'Sensor Design', description: 'Design low-cost soil moisture sensor under ₹500 per unit.' },
      { title: 'Cloud Dashboard', description: 'Build real-time monitoring dashboard for farmers.' },
    ],
    milestones: [
      { name: 'Sensor Prototype', deliverable: 'Working Sensor v1.0', dueDate: '2024-12-01', status: 'In Progress' },
      { name: 'Field Deployment', deliverable: 'Pilot with 50 farmers', dueDate: '2025-06-01', status: 'Not Started' },
    ],
    budget: {
      year1: { Manpower: 300000, Travel: 50000, Equipment: 400000, Contingency: 100000, Overhead: 50000 },
    },
    equipmentDetails: [{ item: 'Sensor Components Kit', amount: 200000 }, { item: 'Arduino/ESP32 Boards', amount: 80000 }],
    sanctionLetterLink: '#',
    documents: [],
    positions: [],
  },
  {
    id: 'TIET-ME-2023-055',
    title: 'Autonomous Underwater Vehicle Navigation using Deep Reinforcement Learning',
    category: 'Research',
    fundingAgency: 'DRDO Research Cell',
    amount: 8800000,
    tietShare: 6500000,
    role: 'PI',
    status: 'Completed',
    startDate: '2021-04-01',
    endDate: '2024-03-31',
    durationYears: 3,
    durationMonths: 0,
    description: 'Development of autonomous navigation algorithms for underwater vehicles using deep reinforcement learning for defence applications.',
    focusArea: 'Robotics & Defense',
    grantType: 'Defence Research Grant',
    pi: { ...facultyPI },
    coPIs: [{ type: 'internal', name: 'Dr. Rajesh Kumar', department: 'Mechanical Engineering', designation: 'Assistant Professor' }],
    objectives: [
      { title: 'DRL Navigation', description: 'Develop DRL-based obstacle avoidance in turbid waters.' },
      { title: 'Hardware Integration', description: 'Integrate navigation system with AUV hardware platform.' },
    ],
    milestones: [
      { name: 'Simulation Environment', deliverable: 'Gazebo Simulation Setup', dueDate: '2021-10-01', status: 'Completed' },
      { name: 'Algorithm Training', deliverable: 'Trained DRL Model', dueDate: '2022-06-01', status: 'Completed' },
      { name: 'Hardware Testing', deliverable: 'AUV Pool Tests', dueDate: '2023-06-01', status: 'Completed' },
      { name: 'Final Deliverable', deliverable: 'DRDO Technical Report', dueDate: '2024-03-31', status: 'Completed' },
    ],
    budget: {
      year1: { Manpower: 700000, Travel: 200000, Equipment: 1500000, Contingency: 200000, Overhead: 100000 },
      year2: { Manpower: 800000, Travel: 300000, Equipment: 500000, Contingency: 200000, Overhead: 100000 },
      year3: { Manpower: 900000, Travel: 300000, Equipment: 0, Contingency: 300000, Overhead: 100000 },
    },
    equipmentDetails: [{ item: 'AUV Platform', amount: 1200000 }],
    sanctionLetterLink: '#',
    documents: [{ name: 'DRDO Sanction', type: 'PDF', date: '2021-03-15' }],
    positions: [],
  },
  {
    id: 'TIET-IND-2024-011',
    title: 'AI-Powered Predictive Maintenance for Steel Manufacturing',
    category: 'Industry',
    fundingAgency: 'Tata Steel Ltd.',
    amount: 6500000,
    tietShare: 4000000,
    role: 'PI',
    status: 'Active',
    startDate: '2024-04-01',
    endDate: '2026-03-31',
    durationYears: 2,
    durationMonths: 0,
    description: 'Collaborative project with Tata Steel to develop ML-based predictive maintenance system for rolling mill machinery, reducing unplanned downtime by 40%.',
    focusArea: 'Industry 4.0',
    grantType: 'Industry Collaboration',
    pi: { ...facultyPI },
    coPIs: [],
    objectives: [
      { title: 'Data Pipeline', description: 'Build real-time sensor data ingestion pipeline from rolling mills.' },
      { title: 'Predictive Model', description: 'Train ML models for failure prediction with 95%+ accuracy.' },
    ],
    milestones: [
      { name: 'Data Collection', deliverable: 'Historical Sensor Dataset', dueDate: '2024-09-01', status: 'Completed' },
      { name: 'Model Training', deliverable: 'ML Model v1.0', dueDate: '2025-03-01', status: 'In Progress' },
      { name: 'Pilot Deployment', deliverable: 'Dashboard at Jamshedpur Plant', dueDate: '2025-12-01', status: 'Not Started' },
    ],
    budget: {
      year1: { Manpower: 800000, Travel: 300000, Equipment: 600000, Contingency: 200000, Overhead: 100000 },
      year2: { Manpower: 900000, Travel: 400000, Equipment: 200000, Contingency: 300000, Overhead: 100000 },
    },
    equipmentDetails: [],
    sanctionLetterLink: '#',
    documents: [],
    positions: [{ type: 'Research Intern', title: 'ML Intern — Predictive Maintenance', openings: 2, stipend: '₹15,000/month', deadline: '2025-07-30', applicants: 42, shortlisted: 8 }],
  },
];

// Mock applications data for recruitment
export const sampleApplications = [
  { id: 'a1', name: 'Rahul Verma', position: 'JRF', institute: 'IIT Delhi', cgpa: 9.2, status: 'Shortlisted', skills: ['Python', 'PyTorch', 'NAS'], degree: 'M.Tech CS', research: 'Neural Architecture Search' },
  { id: 'a2', name: 'Priya Mehta', position: 'JRF', institute: 'NIT Trichy', cgpa: 8.8, status: 'Applied', skills: ['TensorFlow', 'Edge Computing'], degree: 'M.Tech ECE', research: 'Edge AI' },
  { id: 'a3', name: 'Ankit Joshi', position: 'Research Intern', institute: 'BITS Pilani', cgpa: 9.5, status: 'Interview Scheduled', skills: ['Python', 'ML', 'IoT'], degree: 'B.E. CSE', research: 'IoT & ML' },
  { id: 'a4', name: 'Simran Kaur', position: 'JRF', institute: 'PEC Chandigarh', cgpa: 8.6, status: 'Rejected', skills: ['MATLAB', 'Signal Processing'], degree: 'M.Tech EE', research: 'Signal Processing' },
  { id: 'a5', name: 'Deepak Rao', position: 'Research Intern', institute: 'TIET', cgpa: 9.0, status: 'Selected', skills: ['React', 'Node.js', 'ML'], degree: 'B.E. CSE', research: 'Full Stack & AI' },
  { id: 'a6', name: 'Kavita Nair', position: 'JRF', institute: 'IISc Bangalore', cgpa: 9.4, status: 'Shortlisted', skills: ['DRL', 'Robotics', 'ROS'], degree: 'M.S. Research', research: 'Autonomous Systems' },
];

// Helper functions
export const getProjectById = (id) => sampleProjects.find(p => p.id === id);

export const getProjectStats = () => {
  const active = sampleProjects.filter(p => p.status === 'Active').length;
  const completed = sampleProjects.filter(p => p.status === 'Completed').length;
  const totalFunding = sampleProjects.reduce((sum, p) => sum + p.amount, 0);
  const consultancy = sampleProjects.filter(p => p.category === 'Consultancy').length;
  const industry = sampleProjects.filter(p => p.category === 'Industry').length;
  const international = sampleProjects.filter(p => p.category === 'International').length;
  return { active, completed, totalFunding, consultancy, industry, international };
};

export const filterProjects = (projects, filter) => {
  if (filter === 'All') return projects;
  if (['Active', 'Completed', 'Pending'].includes(filter)) return projects.filter(p => p.status === filter);
  return projects.filter(p => p.category === filter);
};

export const formatCurrency = (amount) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

export const getMilestoneProgress = (milestones) => {
  if (!milestones || milestones.length === 0) return 0;
  const completed = milestones.filter(m => m.status === 'Completed').length;
  return Math.round((completed / milestones.length) * 100);
};
