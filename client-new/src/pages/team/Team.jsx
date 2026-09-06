import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Team.css';

const mentors = [
  {
    name: 'Dr. Tarunpreet Bhatia',
    title: 'Associate Professor, CSED',
    image: '/images/tarun.jpg',
    linkedin: 'https://www.linkedin.com/in/tarunpreet-bhatia30/',
    email: 'tarunpreet@thapar.edu',
  },
];

const team2025_2026 = [
  {
    name: 'Aadi Jain',
    role: 'UI and UX Designer',
    image: '/images/aadi.png',
    github: 'https://github.com/nandinnijainn',
    linkedin: 'https://www.linkedin.com/in/aadi-jain-3732b4247/',
    email: 'ajain6_be21@thapar.edu',
  },
  {
    name: 'Abhinav Jain',
    role: 'Mobile App Developer',
    image: '/images/abhinav.jpeg',
    github: 'https://github.com/AbhinavJain1234',
    linkedin: 'https://www.linkedin.com/in/abhinavjain30/',
    email: 'abhinav4subs@gmail.com',
  },
  {
    name: 'Akarsh Srivastava',
    role: 'Backend Developer',
    image: '/images/akarsh.jpeg',
    github: 'https://github.com/akarsh911',
    linkedin: 'https://www.linkedin.com/in/aksrv09/',
    email: 'asrivastava2_be22@thapar.edu',
  },
  {
    name: 'Gurman Kaur',
    role: 'Frontend Developer',
    image: '/images/gurman.jpeg',
    github: 'https://github.com/GurmanKD',
    linkedin: 'https://www.linkedin.com/in/gurmankd/',
    email: 'gkaur5_be22@thapar.edu',
  },
  {
    name: 'Nandini Jain',
    role: 'Frontend Developer',
    image: '/images/nandini.jpeg',
    github: 'https://github.com/nandinnijainn',
    linkedin: 'https://www.linkedin.com/in/nandini-jain-446271267/',
    email: 'nandini1904jain@gmail.com',
  },
];

const team2026_2027 = [
  {
    name: 'Arnav Raj Singh',
    role: 'Backend Developer',
    image: '/images/arnav.png',
    github: 'https://github.com/arnavrajsingh19',
    linkedin: 'https://www.linkedin.com/in/arnavrajsingh18',
    email: 'asingh32_be23@thapar.edu',
  },
  {
    name: 'Ishwin',
    role: 'Frontend Developer',
    image: '/images/ishwin.png',
    github: 'https://github.com/ishwin07',
    linkedin: 'https://www.linkedin.com/in/ishwin-syal-b466b02a8',
    email: 'iishwin_be23@thapar.edu',
  },
  {
    name: 'Manjot Kaur',
    role: 'Frontend Developer and UI/UX',
    image: '/images/manjot.jpeg',
    github: 'https://github.com/kaurmanjot20',
    linkedin: 'https://www.linkedin.com/in/kaurmanjot20',
    email: 'mkaur_be23@thapar.edu',
  },
  {
    name: 'Sakshham Bhagat',
    role: 'Backend & App Developer',
    image: '/images/sakshham.png',
    github: 'https://github.com/SakshhamTheCoder',
    linkedin: 'https://www.linkedin.com/in/sakshhamthecoder',
    email: 'sbhagat_be23@thapar.edu',
  },
  {
    name: 'Saumil Makkar',
    role: 'Backend Developer',
    image: '/images/saumil.png',
    github: 'https://github.com/SaumilMakkar',
    linkedin: 'https://www.linkedin.com/in/saumil-makkar-3731a0285',
    email: 'smakkar_be23@thapar.edu',
  },
];

const PersonCard = ({ name, title, image, github, linkedin, email, isMentor }) => {
  const [imgError, setImgError] = React.useState(false);
  const cleanTitle = title ? title.trim() : '';

  const getInitials = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className={`person-card ${isMentor ? 'mentor-card' : ''}`}>
      <div className='avatar-container'>
        {imgError || !image ? (
          <div className='avatar-fallback'>{getInitials(name)}</div>
        ) : (
          <img 
            src={image} 
            alt={name} 
            className='avatar' 
            onError={() => setImgError(true)} 
          />
        )}
      </div>
      <div className='card-content'>
        <h3>{name}</h3>
        <p className='title'>{cleanTitle}</p>
        <div className='social-icons'>
          {github && (
            <a href={github} target='_blank' rel='noopener noreferrer' title="GitHub">
              <i className="fa fa-github" aria-hidden="true"></i>
            </a>
          )}
          {linkedin && (
            <a href={linkedin} target='_blank' rel='noopener noreferrer' title="LinkedIn">
              <i className="fa fa-linkedin-square" aria-hidden="true"></i>
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} title="Email">
              <i className="fa fa-envelope" aria-hidden="true"></i>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

const Team = () => {
  const navigate = useNavigate();

  return (
    <div className='team-page-wrapper'>
      <nav className="page-navbar">
        <div className="nav-container">
          <button onClick={() => navigate(-1)} className="back-button">
            ← Back
          </button>
          <Link to="/" className="nav-home-link">Home</Link>
        </div>
      </nav>
      
      <div className='team-container'>
        <img src='/images/tiet_logo.png' alt='Thapar Logo' className='logo' />
        <h1 className='heading'>Meet the Portal Team</h1>
        <p className='team-subtitle'>
          The dedicated group of mentors, developers, and designers who designed and built the PhD Monitoring Portal.
        </p>

        <h2 className='subheading'>Mentors</h2>
        <div className='mentor-grid'>
          {mentors.map((person) => (
            <PersonCard key={person.name} {...person} isMentor={true} />
          ))}
        </div>

        <hr className='divider' />

        <h2 className='subheading'>Team 2025-2026</h2>
        <div className='team-grid'>
          {team2025_2026.map((person) => (
            <PersonCard key={person.name} {...person} title={person.role}/>
          ))}
        </div>

        <hr className='divider' />

        <h2 className='subheading'>Team 2026-2027</h2>
        <div className='team-grid'>
          {team2026_2027.map((person) => (
            <PersonCard key={person.name} {...person} title={person.role}/>
          ))}
        </div>

        <p className='contact'>
          For queries, you can reach us at{' '}
          <a href='mailto:sbhagat_be23@thapar.edu'>
            sbhagat_be23@thapar.edu
          </a>
        </p>
      </div>
    </div>
  );
};

export default Team;
