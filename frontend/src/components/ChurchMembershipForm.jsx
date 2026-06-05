//src/components/ChurchMembershipForm.jsx
import React, { useState } from 'react';
import '../styles/ChurchMebershipForm.css';

const ChurchMembership = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    maritalStatus: 'Single',
    numberOfChildren: '',
    email: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    // Replace with actual submission logic (e.g., API call)
  };

  return (
    <div className="membership-container">
      <h2 className="membership-heading">
        Share your details to join our community and connect with others.
      </h2>
      <form onSubmit={handleSubmit} className="membership-form">
        <input
          type="text"
          name="firstName"
          placeholder="First Name"
          value={formData.firstName}
          onChange={handleChange}
          className="membership-input"
          required
        />
        <input
          type="text"
          name="lastName"
          placeholder="Last Name"
          value={formData.lastName}
          onChange={handleChange}
          className="membership-input"
          required
        />
        <div className="membership-radio-group">
          <label>
            <input
              type="radio"
              name="maritalStatus"
              value="Married"
              checked={formData.maritalStatus === 'Married'}
              onChange={handleChange}
            />
            Married
          </label>
          <label>
            <input
              type="radio"
              name="maritalStatus"
              value="Single"
              checked={formData.maritalStatus === 'Single'}
              onChange={handleChange}
            />
            Single
          </label>
        </div>
        <select
          name="numberOfChildren"
          value={formData.numberOfChildren}
          onChange={handleChange}
          className="membership-select"
          required
        >
          <option value="">Select number of children</option>
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3+">3+</option>
        </select>
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          value={formData.email}
          onChange={handleChange}
          className="membership-input"
          required
        />
        <button type="submit" className="membership-button">
          Submit Membership Form
        </button>
        <p className="membership-footer">Made with 💜 by Holy Trinity Team</p>
      </form>
    </div>
  );
};

export default ChurchMembership;
