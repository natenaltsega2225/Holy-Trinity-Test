//Reset admin password from EC2 using a Node script
// cd ~/Hamsa-Lomi-Website/backend
// cat > reset-admin-password.js <<'EOF'
// require("dotenv").config();
// const bcrypt = require("bcryptjs");
// const { MongoClient } = require("mongodb");

// async function main() {
//   const uri = process.env.MONGODB_URI;
//   const adminEmail = (process.env.ADMIN_EMAIL || "").trim();
//   const newPassword = process.argv[2];

//   if (!uri) throw new Error("MONGODB_URI is missing in .env");
//   if (!adminEmail) throw new Error("ADMIN_EMAIL is missing in .env");
//   if (!newPassword) throw new Error("Usage: node reset-admin-password.js 'NewPasswordHere'");

//   const client = new MongoClient(uri);
//   await client.connect();

//   const db = client.db("hamsalomi");
//   const admins = db.collection("admins");

//   // Try common email field names (because your schema may not use `email`)
//   const emailFields = ["email", "adminEmail", "userEmail", "username", "loginEmail"];
//   let matchedField = null;
//   let adminDoc = null;

//   for (const f of emailFields) {
//     const q = {};
//     q[f] = adminEmail;
//     const doc = await admins.findOne(q);
//     if (doc) {
//       matchedField = f;
//       adminDoc = doc;
//       break;
//     }
//   }

//   if (!adminDoc) {
//     // Last resort: show first few docs so you can see the real field names
//     const sample = await admins.find({}).limit(3).toArray();
//     console.error("Could not find admin using ADMIN_EMAIL in admins collection.");
//     console.error("Here are up to 3 sample docs to inspect field names:");
//     console.error(sample);
//     process.exit(2);
//   }

//   const hash = await bcrypt.hash(newPassword, 10);

//   // Common password field names: `password`, `pass`, `hash`
//   const pwFields = ["password", "pass", "hash"];
//   let pwFieldToUse = pwFields.find(k => Object.prototype.hasOwnProperty.call(adminDoc, k)) || "password";

//   const filter = {};
//   filter[matchedField] = adminEmail;

//   const update = { $set: { [pwFieldToUse]: hash, updatedAt: new Date() } };

//   const res = await admins.updateOne(filter, update);

//   console.log("Found admin by field:", matchedField);
//   console.log("Updated password field:", pwFieldToUse);
//   console.log("Matched:", res.matchedCount, "Modified:", res.modifiedCount);

//   await client.close();
// }

// main().catch(e => {
//   console.error("ERR:", e.message);
//   process.exit(1);
// });
// EOF

// //
// node reset-admin-password.js 'NewStrongPassword@2026'

// pm2 restart all --update-env
// pm2 save