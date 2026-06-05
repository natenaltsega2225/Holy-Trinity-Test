//src/components/BibleReader.jsx
import React, { useState } from "react";
import { Search, Volume2, AlignJustify, Settings } from "lucide-react";
import './BibleReader.css';

const BibleReader = () => {
  const [selectedBook, setSelectedBook] = useState("Genesis 1");
  const [selectedVersion, setSelectedVersion] = useState("NKJV");

  const bibleText = {
    title: "GENESIS 1",
    subtitle: "The History of Creation",
    verses: [
      {
        number: 1,
        text: "In the beginning God created the heavens and the earth.",
        references: ["Ps. 102:25", "Is. 40:21", "John 1:1–3", "Heb. 1:10"]
      },
      {
        number: 2,
        text: "The earth was without form, and void; and darkness was on the face of the deep. And the Spirit of God was hovering over the face of the waters.",
        references: ["Jer. 4:23", "Gen. 6:3", "Job 26:13"]
      },
      {
        number: 3,
        text: "Then God said, \"Let there be light\"; and there was light.",
        references: ["Ps. 33:6, 9", "2 Cor. 4:6", "Heb. 11:3"]
      },
      {
        number: 4,
        text: "And God saw the light, that it was good; and God divided the light from the darkness.",
        references: []
      },
      {
        number: 5,
        text: "God called the light Day, and the darkness He called Night. So the evening and the morning were the first day.",
        references: ["Job 37:18", "Ps. 19:2"]
      },
      {
        number: 6,
        text: "Then God said, \"Let there be a firmament in the midst of the waters, and let it divide the waters from the waters.\"",
        references: ["Job 37:18", "Jer. 10:12"]
      },
      {
        number: 7,
        text: "Thus God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament; and it was so.",
        references: ["Job 38:8–11", "Prov. 8:27–29"]
      },
      {
        number: 8,
        text: "And God called the firmament Heaven. So the evening and the morning were the second day.",
        references: ["Ps. 148:4"]
      }
    ]
  };

  const Select = ({ value, onValueChange, children, className }) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)} className={`custom-select ${className}`}>
      {children}
    </select>
  );

  const SelectItem = ({ value, children }) => (
    <option value={value}>{children}</option>
  );

  return (
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
                <input
                  type="text"
                  placeholder="Search Bible.com"
                  className="search-input"
                />
              </div>
              <button className="get-app-button">Get the app</button>
              <button className="icon-button">
                <Settings className="icon" />
              </button>
            </div>
          </div>
          <div className="bible-controls">
            <Select value={selectedBook} onValueChange={setSelectedBook} className="book-select">
              <SelectItem value="Genesis 1">Genesis 1</SelectItem>
              <SelectItem value="Genesis 2">Genesis 2</SelectItem>
              <SelectItem value="Exodus 1">Exodus 1</SelectItem>
            </Select>

            <Select value={selectedVersion} onValueChange={setSelectedVersion} className="version-select">
              <SelectItem value="NKJV">NKJV</SelectItem>
              <SelectItem value="NIV">NIV</SelectItem>
              <SelectItem value="ESV">ESV</SelectItem>
              <SelectItem value="KJV">KJV</SelectItem>
            </Select>

            <div className="bible-actions">
              <button className="action-button">
                <AlignJustify className="action-icon" />
                Parallel
              </button>
              <button className="action-button">
                <Volume2 className="action-icon" />
                Audio
              </button>
              <div className="font-size-control">Aa</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bible-text-content">
        <div className="text-header">
          <h1 className="chapter-title">{bibleText.title}</h1>
          <h2 className="chapter-subtitle">{bibleText.subtitle}</h2>
        </div>

        <div className="verse-container">
          {bibleText.verses.map((verse) => (
            <p key={verse.number} className="verse-paragraph">
              <span className="verse-number">{verse.number}</span>
              <span className="verse-text">{verse.text}</span>
              {verse.references.length > 0 && (
                <span className="verse-references">
                  {verse.references.map((ref, index) => (
                    <span key={ref}>
                      <a href="#" className="reference-link">{ref}</a>
                      {index < verse.references.length - 1 && "; "}
                    </span>
                  ))}
                </span>
              )}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BibleReader;