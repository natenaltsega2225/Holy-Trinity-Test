// backend/constants/donationCategories.js
"use strict";

const DONATION_CATEGORIES = Object.freeze({
  plate_collection: {
    value: "plate_collection",
    label: "መባ — Plate Collection",
    amharic: "መባ",
    english: "Plate Collection",
  },

  candle_sale: {
    value: "candle_sale",
    label: "ሻማ — Candle Sale",
    amharic: "ሻማ",
    english: "Candle Sale",
  },

  general_donation: {
    value: "general_donation",
    label: "ስጦታ — General Donation",
    amharic: "ስጦታ",
    english: "General Donation",
  },

  tithe: {
    value: "tithe",
    label: "አስራት — Tithe",
    amharic: "አስራት",
    english: "Tithe",
  },

  vows: {
    value: "vows",
    label: "ስዕለት — Vows",
    amharic: "ስዕለት",
    english: "Vows",
  },

  baptism: {
    value: "baptism",
    label: "ክርስትና — Baptism",
    amharic: "ክርስትና",
    english: "Baptism",
  },

  wedding_engagement: {
    value: "wedding_engagement",
    label: "ጋብቻ — Wedding / Engagement",
    amharic: "ጋብቻ",
    english: "Wedding / Engagement",
  },

  memorial_service: {
    value: "memorial_service",
    label: "ፍታት — Memorial Service",
    amharic: "ፍታት",
    english: "Memorial Service",
  },

  pledge: {
    value: "pledge",
    label: "ቃል ኪዳን — Pledge",
    amharic: "ቃል ኪዳን",
    english: "Pledge",
  },

  building_fund: {
    value: "building_fund",
    label: "የህንፃ ፈንድ — Building Fund",
    amharic: "የህንፃ ፈንድ",
    english: "Building Fund",
  },

  charity_fund: {
    value: "charity_fund",
    label: "የበጎ አድራጎት ፈንድ — Charity Fund",
    amharic: "የበጎ አድራጎት ፈንድ",
    english: "Charity Fund",
  },

  auction: {
    value: "auction",
    label: "ጨረታ — Auction",
    amharic: "ጨረታ",
    english: "Auction",
  },

  other_fund: {
    value: "other_fund",
    label: "ሌላ — Other",
    amharic: "ሌላ",
    english: "Other",
  },
});

function getDonationCategory(value) {
  const key = String(value || "").trim();

  return (
    DONATION_CATEGORIES[key] || {
      value: key || "general_donation",
      label: key || "General Donation",
      amharic: "",
      english: key || "General Donation",
    }
  );
}

function donationCategoryLabel(value) {
  return getDonationCategory(value).label;
}

function donationCategoryOptions() {
  return Object.values(DONATION_CATEGORIES);
}

module.exports = {
  DONATION_CATEGORIES,
  getDonationCategory,
  donationCategoryLabel,
  donationCategoryOptions,
};