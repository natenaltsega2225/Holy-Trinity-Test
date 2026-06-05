// //frontend\src\components\Serve.jsx
// import React from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   Heart,
//   Users,
//   CalendarDays,
//   Clock3,
// } from "lucide-react";
// import "../styles/serve.css";

// const Serve = () => {
//   const navigate = useNavigate();

//   const serveCards = [
//     {
//       id: 1,
//       title: "Explore Ministry Roles",
//       description:
//         "Discover the volunteer teams that support worship, fellowship, operations, outreach, and church growth.",
//       icon: <Heart size={42} color="#133A74" />,
//     },
//     {
//       id: 2,
//       title: "Join Volunteer Activities",
//       description:
//         "View available activities posted by admin with date, time, location, and service details.",
//       icon: <CalendarDays size={42} color="#133A74" />,
//     },
//     {
//       id: 3,
//       title: "Sign Up for Volunteer Hours",
//       description:
//         "Choose a role, select a service time, and sign up to serve in an organized and trackable way.",
//       icon: <Clock3 size={42} color="#133A74" />,
//     },
//     {
//       id: 4,
//       title: "Build Community",
//       description:
//         "Serve alongside others in ministries that encourage fellowship, unity, and spiritual growth.",
//       icon: <Users size={42} color="#133A74" />,
//     },
//   ];

//   return (
//     <section id="serve-section" className="serve-section">
//       <div className="serve-container">
//         <div className="serve-header">
//           <p className="serve-eyebrow">Serve With Us</p>
        
//           <p className="serve-subtitle">
//             Explore ministry roles, view available volunteer activities, and sign
//             up for service opportunities. All roles, activities, dates, and hours
//             are managed by admin, while members get a clean and simple sign-up
//             experience.
//           </p>
//         </div>

//         <div className="serve-cards">
//           {serveCards.map((card) => (
//             <div key={card.id} className="serve-card">
//               <div className="serve-card-icon">{card.icon}</div>
//               <div className="serve-card-content">
//                 <h3>{card.title}</h3>
//                 <p>{card.description}</p>
//               </div>
//             </div>
//           ))}
//         </div>

//         <div className="serve-actions">
//           <button
//             className="serve-btn main-serve-btn"
//             onClick={() => navigate("/serve")}
//           >
//             Serve Our Church
//           </button>
//         </div>
//       </div>
//     </section>
//   );
// };

// export default Serve;


 //frontend\src\components\Serve.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Users, CalendarDays, Clock3 } from "lucide-react";
import "../styles/Home.css";

const Serve = () => {
  const navigate = useNavigate();

  const serveCards = [
    {
      id: 1,
      title: "Explore Ministry Roles",
      description:
        "Discover volunteer teams that support worship, fellowship, operations, outreach, and church growth.",
      icon: <Heart size={24} />,
    },
    {
      id: 2,
      title: "Join Volunteer Activities",
      description:
        "View available service activities posted by admin with date, time, location, and ministry details.",
      icon: <CalendarDays size={24} />,
    },
    {
      id: 3,
      title: "Sign Up for Volunteer Hours",
      description:
        "Choose a role, select a service time, and sign up to serve in an organized and trackable way.",
      icon: <Clock3 size={24} />,
    },
    {
      id: 4,
      title: "Build Community",
      description:
        "Serve alongside others in ministries that encourage fellowship, unity, and spiritual growth.",
      icon: <Users size={24} />,
    },
  ];

  return (
    <section id="serve-section" className="ht-section ht-section-white">
      <div className="ht-container">
        <div className="ht-section-head">
          <h2 className="ht-section-title">Serve With Us</h2>
          <p className="ht-section-subtitle">
            Explore ministry roles, view available volunteer activities, and
            sign up for service opportunities through a clean and guided
            experience.
          </p>
        </div>

        <div className="ht-grid ht-grid-4">
          {serveCards.map((card) => (
            <div key={card.id} className="ht-card ht-card-equal">
              <div className="ht-icon-ring">{card.icon}</div>
              <h3 className="ht-card-title">{card.title}</h3>
              <p className="ht-card-text">{card.description}</p>
            </div>
          ))}
        </div>

        <div className="ht-section-actions">
          <button className="ht-btn ht-btn-gold" onClick={() => navigate("/serve")}>
            Serve Our Church
          </button>
        </div>
      </div>
    </section>
  );
};

export default Serve;