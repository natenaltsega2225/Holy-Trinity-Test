import React from "react";
import { Cross, BookOpen, Sparkles } from "lucide-react";
import "../../styles/aboutSections.css";
import "../../styles/ourFaith.css";

const iconProps = {
  size: 20,
  strokeWidth: 2.1,
};

const OurFaith = () => {
  const pillars = [
    {
      icon: Cross,
      title: "Orthodox Worship",
      text: "We preserve the sacred worship, liturgy, prayer life, and spiritual discipline of the Ethiopian Orthodox Tewahedo tradition.",
    },
    {
      icon: BookOpen,
      title: "Holy Scripture",
      text: "Our faith is grounded in Holy Scripture, the teachings of the Church, and the inheritance passed down through the saints and fathers.",
    },
    {
      icon: Sparkles,
      title: "Living Tradition",
      text: "We embrace a living faith that shapes family life, service, discipleship, humility, and daily devotion to God.",
    },
  ];

  return (
    <section className="about-section-shell">
      <div className="about-section-top">
        <span className="about-section-kicker">Faith</span>
        <h2 className="about-section-title">Our Faith</h2>
        <p className="about-section-subtitle">
          The Orthodox Creed summarizes what we believe and confess in the
          Ethiopian Orthodox Tewahedo Church.
        </p>
      </div>

      <div className="faith-pillars-grid">
        {pillars.map((item, index) => {
          const Icon = item.icon;
          return (
            <article key={index} className="faith-pillar-card about-section-card">
              <div className="faith-pillar-icon about-section-icon-tile">
                <Icon {...iconProps} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          );
        })}
      </div>

      <div className="faith-content-card about-section-card">
        <h3>The Orthodox Creed of Faith</h3>

        <p>
          We believe in one God, God the Father, the Pantocrator, Who created
          heaven and earth, and all things, seen and unseen.
        </p>

        <p>
          We believe in one Lord Jesus Christ, the Only-Begotten Son of God,
          begotten of the Father before all ages; Light of Light, true God of
          true God, begotten not created, of one essence with the Father, by
          Whom all things were made; Who for us, men, and for our salvation,
          came down from heaven, and was incarnated of the Holy Spirit and of
          the Virgin Mary, and became man.
        </p>

        <p>
          And He was crucified for us under Pontius Pilate, suffered, and was
          buried. And on the third day He rose from the dead, according to the
          Scriptures, and ascended into the heavens; and sat at the right hand
          of His Father, and also He is coming again in His glory to judge the
          living and the dead, whose kingdom has no end.
        </p>

        <p>
          Yes, we believe in the Holy Spirit, the Lord, the Life-Giver, Who
          proceeds from the Father, Who, with the Father and the Son, is
          worshipped and glorified, Who spoke in the prophets. And in one holy,
          catholic, and apostolic church. We confess one baptism for the
          remission of sins.
        </p>

        <p>
          We look for the resurrection of the dead, and the life of the coming
          age. Amen.
        </p>
      </div>
    </section>
  );
};

export default OurFaith;