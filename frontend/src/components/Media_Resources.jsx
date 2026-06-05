// //frontend\src\components\Media_Resources.jsx
// import React from "react";
// import { Link } from "react-router-dom";
// import "../styles/media_resources.css";

// import { FaImages, FaBookOpen } from "react-icons/fa";

// export default function Media_Resources() {
//   const cards = [
//     {
//       title: "Photo Gallery",
//       desc: "See moments from feast days, celebrations, and community gatherings.",
//       to: "/more/media-gallery",
//       icon: <FaImages size={40} color="#F2BE42" />,
//     },
//     {
//       title: "Church Resources",
//       desc: "Access liturgical guides, study materials, and downloadable documents.",
//       to: "/more/media-resources",
//       icon: <FaBookOpen size={40} color="#F2BE42" />,
//     }
//   ];

//   return (
//     <section id="media-resources" className="mr-section">
//       <div className="mr-container">
//         <header className="mr-head">
//           <h1 className="mr-title">Media & Resources</h1>
//           <p className="mr-sub">
//             Explore highlights from our photo gallery and access important church documents.
//           </p>
//         </header>

//         <div className="mr-cards">
//           {cards.map((card) => (
//             <Link key={card.title} to={card.to} className="mr-card">
//               <div className="mr-card-icon">{card.icon}</div>
//               <h3 className="mr-card-title">{card.title}</h3>
//               <p className="mr-card-desc">{card.desc}</p>
//             </Link>
//           ))}
//         </div>
//       </div>
//     </section>
//   );
// }


//frontend\src\components\Media_Resources.jsx
import React from "react";
import { Link } from "react-router-dom";
import { FaImages, FaBookOpen } from "react-icons/fa";
import "../styles/Home.css";

export default function Media_Resources() {
  const cards = [
    {
      title: "Photo Gallery",
      desc: "See moments from feast days, celebrations, and community gatherings.",
      to: "/more/media-gallery",
      icon: <FaImages size={24} />,
    },
    {
      title: "Church Resources",
      desc: "Access liturgical guides, study materials, and downloadable church documents.",
      to: "/more/media-resources",
      icon: <FaBookOpen size={24} />,
    },
  ];

  return (
    <section id="media-resources" className="ht-section ht-section-white">
      <div className="ht-container">
        <header className="ht-section-head">
          <h2 className="ht-section-title">Media & Resources</h2>
          <p className="ht-section-subtitle">
            Explore moments from church life and access important learning and
            worship materials.
          </p>
        </header>

        <div className="ht-grid ht-grid-2 ht-grid-centered">
          {cards.map((card) => (
            <Link key={card.title} to={card.to} className="ht-card ht-card-equal">
              <div className="ht-icon-ring">{card.icon}</div>
              <h3 className="ht-card-title">{card.title}</h3>
              <p className="ht-card-text">{card.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}