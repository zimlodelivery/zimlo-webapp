// Run this once after setting up the database: `npx prisma db seed`
// Populates the starting menu (you can add/edit/remove all of this later
// from the Admin dashboard — you never need to touch this file again).

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const menu = [
  // ---- नाश्ता (Nashta) ----
  { category: "nashta", name: "पोहा", price: 25, unit: "plate", sortOrder: 1 },
  { category: "nashta", name: "जलेबी", price: 50, unit: "plate", sortOrder: 2 },
  { category: "nashta", name: "समोसा", price: 20, unit: "piece", sortOrder: 3 },
  { category: "nashta", name: "पालक बड़ा", price: 20, unit: "piece", sortOrder: 4 },
  { category: "nashta", name: "कचौड़ी", price: 20, unit: "piece", sortOrder: 5 },

  // ---- भोजन (Bhojan) ----
  { category: "bhojan", name: "दाल बाफले", price: 150, unit: "plate", sortOrder: 1 },
  { category: "bhojan", name: "तवा रोटी", price: 15, unit: "piece", sortOrder: 2 },
  { category: "bhojan", name: "सेव भाजी", price: 100, unit: "plate", sortOrder: 3 },
  { category: "bhojan", name: "दाल", price: 80, unit: "plate", sortOrder: 4 },

  // ---- नॉन-वेज (Non-Veg) ----
  { category: "nonveg", name: "चिकन करी", price: 200, unit: "plate", sortOrder: 1 },
  { category: "nonveg", name: "मटन करी", price: 200, unit: "plate", sortOrder: 2 },
  { category: "nonveg", name: "अंडा करी", price: 150, unit: "plate", sortOrder: 3 },
];

async function main() {
  for (const item of menu) {
    await db.menuItem.create({ data: item });
  }
  await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, upiId: "rohitmeena0555@ybl", brandName: "Zimlo", contactPhone: "" },
  });
  console.log(`Seeded ${menu.length} menu items + settings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
