import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Team.css';

const mentor = {
  name: 'Dr. Tarunpreet Bhatia',
  title: 'Associate Professor, CSED',
  image: '/images/tarun.jpg',
  linkedin: 'https://www.linkedin.com/in/tarunpreet-bhatia30/',
  email: 'tarunpreet@thapar.edu',
};

// The batch reads under the name. It replaced the two batch sections, which
// split the team into two grids and made the second look like an afterthought.
// The order is unchanged: the older batch first. Each person carries their own
// string rather than sharing a constant, because the branch differs.

const team = [
  {
    name: 'Aadi Jain',
    role: 'UI and UX Designer',
    batch: 'B.E. COE (2021-2025)',
    image: '/images/aadi.png',
    github: 'https://github.com/nandinnijainn',
    linkedin: 'https://www.linkedin.com/in/aadi-jain-3732b4247/',
    email: 'ajain6_be21@thapar.edu',
  },
  {
    name: 'Abhinav Jain',
    role: 'Mobile App Developer',
    batch: 'B.E. COE (2022-2026)',
    image: '/images/abhinav.jpeg',
    github: 'https://github.com/AbhinavJain1234',
    linkedin: 'https://www.linkedin.com/in/abhinavjain30/',
    email: 'abhinav4subs@gmail.com',
  },
  {
    name: 'Akarsh Srivastava',
    role: 'Backend Developer',
    batch: 'B.E. COE (2022-2026)',
    image: '/images/akarsh.jpeg',
    github: 'https://github.com/akarsh911',
    linkedin: 'https://www.linkedin.com/in/aksrv09/',
    email: 'asrivastava2_be22@thapar.edu',
  },
  {
    name: 'Nandini Jain',
    role: 'Frontend Developer',
    batch: 'B.E. COE (2022-2026)',
    image: '/images/nandini.jpeg',
    github: 'https://github.com/nandinnijainn',
    linkedin: 'https://www.linkedin.com/in/nandini-jain-446271267/',
    email: 'nandini1904jain@gmail.com',
  },
  {
    name: 'Arnav Raj Singh',
    role: 'Backend Developer',
    batch: 'B.E. ECE (2023-2027)',
    image: '/images/arnav.png',
    github: 'https://github.com/arnavrajsingh19',
    linkedin: 'https://www.linkedin.com/in/arnavrajsingh18',
    email: 'asingh32_be23@thapar.edu',
  },
  {
    name: 'Manjot Kaur',
    role: 'Frontend Developer and UI/UX',
    batch: 'B.E. COE (2023-2027)',
    image: '/images/manjot.jpeg',
    github: 'https://github.com/kaurmanjot20',
    linkedin: 'https://www.linkedin.com/in/kaurmanjot20',
    email: 'mkaur_be23@thapar.edu',
  },
  {
    name: 'Sakshham Bhagat',
    role: 'Backend & App Developer',
    batch: 'B.E. COE (2023-2027)',
    image: '/images/sakshham.png',
    github: 'https://github.com/SakshhamTheCoder',
    linkedin: 'https://www.linkedin.com/in/sakshhamthecoder',
    email: 'sbhagat_be23@thapar.edu',
  },
  {
    name: 'Saumil Makkar',
    role: 'Backend Developer',
    batch: 'B.E. COE (2023-2027)',
    image: '/images/saumil.png',
    github: 'https://github.com/SaumilMakkar',
    linkedin: 'https://www.linkedin.com/in/saumil-makkar-3731a0285',
    email: 'smakkar_be23@thapar.edu',
  },
];

const PersonCard = ({ name, title, batch, image, github, linkedin, email, isMentor }) => {
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
        {batch && <p className='person-batch'>{batch}</p>}
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
          The mentor, developers and designers who designed and built the Doctoral, Research and Innovation Management Portal.
        </p>

        <div className='team-layout'>
          <div className='team-mentor'>
            <h2 className='subheading'>Mentor</h2>
            <PersonCard {...mentor} isMentor={true} />
          </div>

          <div className='team-members'>
            <h2 className='subheading'>The Team</h2>
            <div className='team-grid'>
              {team.map((person) => (
                <PersonCard key={person.name} {...person} title={person.role} />
              ))}
            </div>
          </div>
        </div>

        <p className='contact'>
          For queries, you can reach us at{' '}
          <a href='mailto:tarunpreet@thapar.edu'>tarunpreet@thapar.edu</a>
          {' '}or{' '}
          <a href='mailto:sbhagat_be23@thapar.edu'>sbhagat_be23@thapar.edu</a>
        </p>
      </div>
    </div>
  );
};

export default Team;
