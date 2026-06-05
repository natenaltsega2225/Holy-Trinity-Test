import React from "react";
import { Calendar, Church, Users, BookOpen } from "lucide-react";
import "../../styles/aboutSections.css";
import "../../styles/ourHistory.css";

const OurHistory = () => {
  const milestones = [
    {
      year: "1st Century",
      title: "Ancient Origins",
      description:
        "The Ethiopian Orthodox Tewahedo Church traces its roots to the conversion of the Ethiopian eunuch by Philip the Apostle, as recorded in Acts 8:26-40.",
      icon: BookOpen,
    },
    {
      year: "4th Century",
      title: "Christianity Declared",
      description:
        "King Ezana of Axum declared Christianity as the official religion of Ethiopia, making it one of the oldest Christian nations in the world.",
      icon: Church,
    },
    {
      year: "1959",
      title: "Autocephaly Granted",
      description:
        "The Ethiopian Orthodox Tewahedo Church was granted autocephaly by the Coptic Orthodox Church of Alexandria.",
      icon: Calendar,
    },
    {
      year: "Present Day",
      title: "Holy Trinity Established",
      description:
        "Holy Trinity Ethiopian Orthodox Tewahedo Church was established to serve the growing Ethiopian Orthodox community in our local area.",
      icon: Users,
    },
  ];

  return (
    <section className="about-section-shell">
      <div className="about-section-top">
        <span className="about-section-kicker">Heritage</span>
        <h2 className="about-section-title">Our Sacred History</h2>
        <p className="about-section-subtitle">
          The Ethiopian Orthodox Tewahedo Church is one of the oldest Christian
          churches in the world, with a rich heritage spanning nearly two millennia.
        </p>
      </div>

      <div className="history-timeline">
        {milestones.map((milestone, index) => {
          const Icon = milestone.icon;
          return (
            <div
              key={index}
              className="history-milestone animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="history-card about-section-card">
                <div className="history-card-content">
                  <div className="history-icon-wrapper about-section-icon-tile">
                    <Icon className="history-icon" strokeWidth={2.2} />
                  </div>

                  <div className="history-text">
                    <div className="history-year-row">
                      <span className="history-year">{milestone.year}</span>
                      <div className="history-line"></div>
                    </div>
                    <h3 className="history-milestone-title">{milestone.title}</h3>
                    <p className="history-milestone-desc">{milestone.description}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="history-additional">
        <div className="history-additional-card about-section-card animate-fade-in-up">
          <h3>Our Local Community</h3>
          <p>
            Holy Trinity Ethiopian Orthodox Tewahedo Church was established to
            serve the growing Ethiopian Orthodox community in our area. We are
            committed to preserving the ancient traditions while welcoming all
            who seek spiritual growth.
          </p>
          <p>
            Our church serves as a spiritual home for families and individuals,
            providing worship services, religious education, and community
            support in the Orthodox tradition.
          </p>
        </div>

        <div
          className="history-additional-card about-section-card animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          <h3>Our Mission</h3>
          <p>
            We are dedicated to maintaining the spiritual, cultural, and
            liturgical heritage of the Ethiopian Orthodox Tewahedo Church.
            Through worship, education, and fellowship, we strengthen our
            community&apos;s faith.
          </p>
          <p>
            Our mission is to provide a welcoming environment where all can
            experience the beauty of Orthodox Christianity and grow in their
            relationship with God.
          </p>
        </div>
      </div>
    </section>
  );
};

export default OurHistory;