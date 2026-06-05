// // src/components/Ministries.jsx
// import React from "react";
// import { NavLink } from "react-router-dom";
// import { FaPray, FaUsers, FaVideo, FaHandsHelping } from "react-icons/fa"; // example Lucid icons
// import "../styles/ministries.css"; // file must be exactly `ministries.css`
// // import "../styles/auth.css";


// const items = [
//   {
//     title: "Liturgical Life",
//     desc:
//       "Learning the structure, meaning, and participation in Kidase (Divine Liturgy) and other services. Includes resources or links for those learning to serve, chant, or assist liturgically.",
//     icon: <FaPray size={36} color="#F2BE42" />,
//   },
//   {
//     title: "Youth Ministry",
//     desc:
//       "Spiritual formation and fellowship for teens and young adults through prayer, discussion, and service.",
//     icon: <FaUsers size={36} color="#F2BE42" />,
//   },
//   {
//     title: "Sermons",
//     desc:
//       "Check our YouTube channel for sermons and teachings. Watch our past sermons and spiritual teachings on our YouTube page.",
//     icon: <FaVideo size={36} color="#F2BE42" />,
//   },
//   {
//     title: "Service & Outreach",
//     desc:
//       "Supporting our community through charitable works, seasonal drives, and helping those in need.",
//     icon: <FaHandsHelping size={36} color="#F2BE42" />,
//   },
// ];

// export default function Ministries() {
//   return (
//     <section id="ministries" className="min-wrap">
//       <div className="min-container">
//         <header className="min-head">
//           <h1 className="min-title">Our Ministries</h1>
//           <p className="min-sub">
//             Discover opportunities to grow in faith, serve others, and build lasting relationships within our church community through our various ministry programs.
//           </p>
//         </header>

//         <div className="min-grid">
//           {items.map((it) => (
//             <NavLink key={it.title} to={it.to || "#"} className="min-card">
//               <div className="min-icon">{it.icon}</div>
//               <h3 className="min-card-title">{it.title}</h3>
//               <p className="min-card-desc">{it.desc}</p>
//             </NavLink>
//           ))}
//         </div>
//       </div>
//     </section>
//   );
// }

// src/components/Ministries.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import { FaPray, FaUsers, FaVideo, FaHandsHelping } from "react-icons/fa";
import "../styles/Home.css";

const items = [
  {
    title: "Liturgical Life",
    desc:
      "Learn the meaning and rhythm of Kidase and other sacred services, including resources for those who are growing in liturgical participation.",
    icon: <FaPray size={24} />,
  },
  {
    title: "Youth Ministry",
    desc:
      "Support spiritual formation and fellowship for teens and young adults through prayer, teaching, discussion, and community service.",
    icon: <FaUsers size={24} />,
  },
  {
    title: "Sermons",
    desc:
      "Watch sermons and teachings from our church and stay connected to spiritual encouragement throughout the week.",
    icon: <FaVideo size={24} />,
  },
  {
    title: "Service & Outreach",
    desc:
      "Join charitable works, community support efforts, and outreach activities that serve families and neighbors in need.",
    icon: <FaHandsHelping size={24} />,
  },
];

export default function Ministries() {
  return (
    <section id="ministries" className="ht-section ht-section-alt">
      <div className="ht-container">
        <header className="ht-section-head">
          <h2 className="ht-section-title">Our Ministries</h2>
          <p className="ht-section-subtitle">
            Discover opportunities to grow in faith, serve others, and build
            lasting relationships within our church community through our
            ministry programs.
          </p>
        </header>

        <div className="ht-grid ht-grid-4">
          {items.map((it) => (
            <NavLink key={it.title} to={it.to || "#"} className="ht-card ht-card-equal">
              <div className="ht-icon-ring">{it.icon}</div>
              <h3 className="ht-card-title">{it.title}</h3>
              <p className="ht-card-text">{it.desc}</p>
            </NavLink>
          ))}
        </div>
      </div>
    </section>
  );
}