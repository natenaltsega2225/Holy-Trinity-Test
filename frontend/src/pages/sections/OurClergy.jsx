// import React from "react";
import React from "react";
import "../../styles/aboutSections.css";
import "../../styles/ourClergy.css";
import AbuneMathias from "../../assets/images/Abune_Mathias.jpg";
import AbuneYakob from "../../assets/images/Abune_Yakob.jpg";
import KesisTadesse from "../../assets/images/Kesis_Tadesse.jpg";
import KesisTesfa from "../../assets/images/Kesis_Tesfa.jpg";
import KesisFanuel from "../../assets/images/Kesis_Fanuel.jpg";
import PriestsDeaconsGroup from "../../assets/images/Priests_Deacons.jpg";

const OurClergy = () => {
  const hierarchy = {
    patriarch: {
      name: "His Holiness Abune Mathias",
      title: "Patriarch",
      image: AbuneMathias,
    },
    archbishop: {
      name: "His Grace Abune Yakob",
      title: "Archbishop",
      image: AbuneYakob,
    },
    priestsAndDeacons: [
      { name: "Melake Birhane", title: "Kesis Tadesse", image: KesisTadesse },
      { name: "Megabi Haddis", title: "Memhir Tesfa", image: KesisTesfa },
      { name: "Kesis Fanuel", title: "Fanuel", image: KesisFanuel },
    ],
  };

  return (
    <section className="about-section-shell">
      <div className="about-section-top">
        <span className="about-section-kicker">Leadership</span>
        <h2 className="about-section-title">Our Clergy</h2>
        <p className="about-section-subtitle">
          Meet the spiritual leaders who guide our church community with wisdom,
          devotion, and unwavering faith.
        </p>
      </div>

      <div className="clergy-hierarchy">
        <div className="clergy-group">
          <h3 className="clergy-group-title">Patriarch</h3>
          <div className="clergy-card clergy-card-featured about-section-card">
            <div className="clergy-card-content">
              <div className="clergy-img-wrapper">
                <img
                  src={hierarchy.patriarch.image}
                  alt={hierarchy.patriarch.name}
                  className="clergy-img"
                />
              </div>
              <h4 className="clergy-name">{hierarchy.patriarch.name}</h4>
              <p className="clergy-title-text">{hierarchy.patriarch.title}</p>
            </div>
          </div>
        </div>

        <div className="clergy-group">
          <h3 className="clergy-group-title">Archbishop</h3>
          <div className="clergy-card clergy-card-featured about-section-card">
            <div className="clergy-card-content">
              <div className="clergy-img-wrapper">
                <img
                  src={hierarchy.archbishop.image}
                  alt={hierarchy.archbishop.name}
                  className="clergy-img"
                />
              </div>
              <h4 className="clergy-name">{hierarchy.archbishop.name}</h4>
              <p className="clergy-title-text">{hierarchy.archbishop.title}</p>
            </div>
          </div>
        </div>

        <div className="clergy-group">
          <h3 className="clergy-group-title">Priests</h3>
          <div className="clergy-deacons">
            {hierarchy.priestsAndDeacons.map((deacon, index) => (
              <div className="clergy-card about-section-card" key={index}>
                <div className="clergy-card-content">
                  <div className="clergy-img-wrapper">
                    <img
                      src={deacon.image}
                      alt={deacon.name}
                      className="clergy-img"
                    />
                  </div>
                  <h4 className="clergy-name">{deacon.name}</h4>
                  <p className="clergy-title-text">{deacon.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="priests-section">
        <h3 className="priests-title">Priests &amp; Deacons</h3>
        <div className="priests-card">
          <div className="priests-img-wrapper about-section-card">
            <img
              src={PriestsDeaconsGroup}
              alt="Priests and Deacons"
              className="priests-img"
            />
          </div>
        </div>
        <p className="priests-description">
          Our dedicated priests and deacons serve the community with devotion,
          leading worship services, providing spiritual guidance, and preserving
          the sacred traditions of the Ethiopian Orthodox Tewahedo Church.
        </p>
      </div>
    </section>
  );
};

export default OurClergy;