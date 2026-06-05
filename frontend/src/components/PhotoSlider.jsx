
// src/components/PhotoSlider.jsx
import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "../styles/PhotoSlider.css";

// make sure these files exist (case-sensitive)
import img1 from "../assets/slides/image1.jpg";
import img2 from "../assets/slides/image2.jpg";
import img3 from "../assets/slides/image3.jpg";

const slides = [
  { id: 1, url: img1, caption: "Learn our History" },
  { id: 2, url: img2, caption: "Welcome to Holy Trinity!" },
  { id: 3, url: img3, caption: "Faith, Tradition & Community" },
];

export default function PhotoSlider() {
  return (
    <section className="photo-slider" aria-label="Photo slider">
      <Swiper
        modules={[Autoplay, Navigation, Pagination]}
        autoplay={{ delay: 5000, disableOnInteraction: false }} // 5 seconds
        navigation // shows prev/next
        pagination={{ clickable: true }}
        loop
      >
        {slides.map((s) => (
          <SwiperSlide key={s.id}>
            <div className="slide">
              <img
                className="slide-img"
                src={s.url}
                alt={s.caption}
                loading="eager"
                onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              />
              <div className="slide-gradient" />
              <div className="slide-caption">{s.caption}</div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
