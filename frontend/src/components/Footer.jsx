// //src/components/Footer.jsx
// import React from "react";
// import { MapPin, Phone, Mail, Facebook, Youtube, Instagram, MessageCircle } from "lucide-react";
// import "../styles/footer.css"; // file must be exactly `footer.css`


// const Footer = () => {
//   return (
//     <footer className="footer">
//       <div className="footer-container">
//         {/* Info Cards */}
//         <div className="footer-cards">
//           <div className="footer-card">
//             <div className="icon-wrapper">
//               <MapPin />
//             </div>
//             <h4>Address</h4>
//             <p>
//               <a
//                 href="https://www.google.com/maps/search/?api=1&query=Debre+Birhan+Holy+Trinity+Ethiopian+Orthodox+Church+Nashville+TN"
//                 target="_blank"
//                 rel="noopener noreferrer"
//               >
//                 2558 Couchville Pike<br />
//                 Nashville, TN 37217
//               </a>
//             </p>
//           </div>

//           <div className="footer-card">
//             <div className="icon-wrapper">
//               <Phone />
//             </div>
//             <h4>Phone</h4>
//             <p>
//               <a href="tel:+16155540638">(615) 554-0638</a>
//             </p>
//           </div>

//           <div className="footer-card email-card">
//             <div className="icon-wrapper">
//               <Mail />
//             </div>
//             <h4>Email</h4>
//             <p>
//               <a href="mailto:holytrinityeotctn@gmail.com">
//                 holytrinityeotctn@gmail.com
//               </a>
//             </p>
//           </div>


//         </div>

//         {/* Social Icons */}
//         <div className="footer-social">
//           <a href="#" aria-label="Facebook">
//             <Facebook />
//           </a>
//           <a href="#" aria-label="YouTube">
//             <Youtube />
//           </a>
//           <a href="#" aria-label="Instagram">
//             <Instagram />
//           </a>
//           <a href="#" aria-label="WhatsApp">
//             <MessageCircle />
//           </a>
//         </div>

//         {/* Footer Bottom */}
//         <div className="footer-bottom">
//           © 2024 Holy Trinity Ethiopian Orthodox Tewahedo Church. All rights reserved.
//         </div>
//       </div>
//     </footer>
//   );
// };

// export default Footer;

import React, { useMemo } from "react";
import {
  MapPin,
  Phone,
  Mail,
  Facebook,
  Youtube,
  Instagram,
  MessageCircle,
} from "lucide-react";
import { usePublicSettings } from "../context/PublicSettingsContext";
import "../styles/footer.css";

const Footer = () => {
  const { settings: publicSettings } = usePublicSettings();

  const address =
    publicSettings?.general?.address ||
    "2558 Couchville Pike, Nashville, TN 37217";

  const phone =
    publicSettings?.general?.contactPhone || "(615) 554-0638";

  const email =
    publicSettings?.general?.supportEmail ||
    "holytrinityeotctn@gmail.com";

  const footerText =
    publicSettings?.branding?.footerText ||
    "© 2024 Holy Trinity Ethiopian Orthodox Tewahedo Church. All rights reserved.";

  const mapsUrl = useMemo(() => {
    const direct = String(publicSettings?.general?.googleMapsUrl || "").trim();
    if (direct) return direct;

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      address
    )}`;
  }, [publicSettings, address]);

  const telHref = useMemo(() => {
    const cleaned = String(phone || "").replace(/[^\d+]/g, "");
    return cleaned ? `tel:${cleaned}` : "#";
  }, [phone]);

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-cards">
          <div className="footer-card">
            <div className="icon-wrapper">
              <MapPin />
            </div>
            <h4>Address</h4>
            <p>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {address}
              </a>
            </p>
          </div>

          <div className="footer-card">
            <div className="icon-wrapper">
              <Phone />
            </div>
            <h4>Phone</h4>
            <p>
              <a href={telHref}>{phone}</a>
            </p>
          </div>

          <div className="footer-card email-card">
            <div className="icon-wrapper">
              <Mail />
            </div>
            <h4>Email</h4>
            <p>
              <a href={`mailto:${email}`}>{email}</a>
            </p>
          </div>
        </div>

        <div className="footer-social">
          <a href="#" aria-label="Facebook">
            <Facebook />
          </a>
          <a href="#" aria-label="YouTube">
            <Youtube />
          </a>
          <a href="#" aria-label="Instagram">
            <Instagram />
          </a>
          <a href="#" aria-label="WhatsApp">
            <MessageCircle />
          </a>
        </div>

        <div className="footer-bottom">{footerText}</div>
      </div>
    </footer>
  );
};

export default Footer;
