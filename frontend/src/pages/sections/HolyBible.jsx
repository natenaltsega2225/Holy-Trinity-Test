import React, { useState } from "react";
import { Search, Volume2, AlignJustify, Settings } from "lucide-react";

const HolyBible = () => {
  const [selectedBook, setSelectedBook] = useState("Genesis 1");
  const [selectedVersion, setSelectedVersion] = useState("NKJV");

  const bibleText = {
    title: "GENESIS 1",
    subtitle: "The History of Creation",
    verses: [
      { number: 1, text: "In the beginning God created the heavens and the earth.", references: ["Ps. 102:25", "Is. 40:21", "John 1:1–3", "Heb. 1:10"] },
      { number: 2, text: "The earth was without form, and void; and darkness was on the face of the deep. And the Spirit of God was hovering over the face of the waters.", references: ["Jer. 4:23", "Gen. 6:3", "Job 26:13"] },
      { number: 3, text: 'Then God said, "Let there be light"; and there was light.', references: ["Ps. 33:6, 9", "2 Cor. 4:6", "Heb. 11:3"] },
      { number: 4, text: "And God saw the light, that it was good; and God divided the light from the darkness.", references: [] },
      { number: 5, text: "God called the light Day, and the darkness He called Night. So the evening and the morning were the first day.", references: ["Job 37:18", "Ps. 19:2"] },
      { number: 6, text: 'Then God said, "Let there be a firmament in the midst of the waters, and let it divide the waters from the waters."', references: ["Job 37:18", "Jer. 10:12"] },
      { number: 7, text: "Thus God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament; and it was so.", references: ["Job 38:8–11", "Prov. 8:27–29"] },
      { number: 8, text: "And God called the firmament Heaven. So the evening and the morning were the second day.", references: ["Ps. 148:4"] },
    ],
  };

  const Select = ({ value, onChange, children, className }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`custom-select ${className || ""}`}>
      {children}
    </select>
  );
  const Option = ({ value, children }) => <option value={value}>{children}</option>;

  return (
    <div className="container" style={{ padding: "24px 0" }}>
      <h1>Holy Bible</h1>

      <div className="bible-reader">
        <div className="bible-header">
          <div className="header-content">
            <div className="header-top">
              <div className="header-logo">YouVersion</div>
              <div className="header-controls">
                <nav className="header-nav-links">
                  <a href="#" className="nav-link">Bible</a>
                  <a href="#" className="nav-link">Plans</a>
                  <a href="#" className="nav-link">Videos</a>
                </nav>
                <div className="search-container">
                  <Search className="search-icon" />
                  <input type="text" placeholder="Search Bible.com" className="search-input" />
                </div>
                <button className="get-app-button">Get the app</button>
                <button className="icon-button"><Settings className="icon" /></button>
              </div>
            </div>

            <div className="bible-controls">
              <Select value={selectedBook} onChange={setSelectedBook} className="book-select">
                <Option value="Genesis 1">Genesis 1</Option>
                <Option value="Genesis 2">Genesis 2</Option>
                <Option value="Exodus 1">Exodus 1</Option>
              </Select>

              <Select value={selectedVersion} onChange={setSelectedVersion} className="version-select">
                <Option value="NKJV">NKJV</Option>
                <Option value="NIV">NIV</Option>
                <Option value="ESV">ESV</Option>
                <Option value="KJV">KJV</Option>
              </Select>

              <div className="bible-actions">
                <button className="action-button"><AlignJustify className="action-icon" />Parallel</button>
                <button className="action-button"><Volume2 className="action-icon" />Audio</button>
                <div className="font-size-control">Aa</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bible-text-content">
          <div className="text-header">
            <h2 className="chapter-title">{bibleText.title}</h2>
            <h3 className="chapter-subtitle">{bibleText.subtitle}</h3>
          </div>

          <div className="verse-container">
            {bibleText.verses.map((v) => (
              <p key={v.number} className="verse-paragraph">
                <span className="verse-number">{v.number}</span>
                <span className="verse-text">{v.text}</span>
                {v.references?.length > 0 && (
                  <span className="verse-references">
                    {v.references.map((r, i) => (
                      <span key={r}>
                        <a href="#" className="reference-link">{r}</a>
                        {i < v.references.length - 1 ? "; " : ""}
                      </span>
                    ))}
                  </span>
                )}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HolyBible;
