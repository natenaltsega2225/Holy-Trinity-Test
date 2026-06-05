

import React, { useState, useRef, useEffect } from "react";
import { Cross, ScrollText, HandHelping } from "lucide-react";
import styles from "../styles/aboutPage.module.css";
import OurFaith from "../pages/sections/OurFaith";
import OurHistory from "../pages/sections/OurHistory";
import OurClergy from "../pages/sections/OurClergy";

const iconProps = {
  size: 18,
  strokeWidth: 2.2,
};

const AboutPage = () => {
  const [activeCard, setActiveCard] = useState("faith");

  const faithRef = useRef(null);
  const historyRef = useRef(null);
  const clergyRef = useRef(null);

  const sectionRefs = [
    { id: "faith", ref: faithRef },
    { id: "history", ref: historyRef },
    { id: "clergy", ref: clergyRef },
  ];

  const handleCardClick = (card) => {
    const section = sectionRefs.find((s) => s.id === card);
    section?.ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + window.innerHeight / 3;

      for (let i = sectionRefs.length - 1; i >= 0; i--) {
        const sectionTop = sectionRefs[i].ref.current?.offsetTop || 0;
        if (scrollPos >= sectionTop) {
          setActiveCard(sectionRefs[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className={styles.aboutContainer}>
      <div className={styles.aboutHeader}>
        <span className={styles.aboutEyebrow}>Holy Trinity EOTC</span>
        <h1 className={styles.aboutTitle}>Who We Are</h1>
        <p className={styles.aboutSubtitle}>
          Discover our faith, history, and clergy guiding our community with
          wisdom, tradition, and devotion.
        </p>
      </div>

      <div className={styles.selectorBar}>
        <button
          type="button"
          className={`${styles.selectorItem}${activeCard === "faith" ? ` ${styles.active}` : ""}`}
          onClick={() => handleCardClick("faith")}
        >
          <span className={styles.selectorIcon}>
            <Cross {...iconProps} />
          </span>
          <span>Our Faith</span>
        </button>

        <button
          type="button"
          className={`${styles.selectorItem}${activeCard === "history" ? ` ${styles.active}` : ""}`}
          onClick={() => handleCardClick("history")}
        >
          <span className={styles.selectorIcon}>
            <ScrollText {...iconProps} />
          </span>
          <span>Our History</span>
        </button>

        <button
          type="button"
          className={`${styles.selectorItem}${activeCard === "clergy" ? ` ${styles.active}` : ""}`}
          onClick={() => handleCardClick("clergy")}
        >
          <span className={styles.selectorIcon}>
            <HandHelping {...iconProps} />
          </span>
          <span>Clergy</span>
        </button>
      </div>

      <div className={styles.sectionStack}>
        <div ref={faithRef}>
          <OurFaith />
        </div>

        <div ref={historyRef}>
          <OurHistory />
        </div>

        <div ref={clergyRef}>
          <OurClergy />
        </div>
      </div>
    </div>
  );
};

export default AboutPage;