require("dotenv").config();

const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const firstName = process.env.ADMIN_FIRST_NAME?.trim();
  const lastName = process.env.ADMIN_LAST_NAME?.trim();
  const password = process.env.ADMIN_PASSWORD || "";

  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !firstName || !lastName || password.length < 12 || password.length > 128) {
    throw new Error("Set ADMIN_EMAIL, ADMIN_FIRST_NAME, ADMIN_LAST_NAME, and a unique 12–128 character ADMIN_PASSWORD in backend/.env.");
  }

  const activeAdmin = await prisma.user.findFirst({ where: { role: "admin", isActive: true }, select: { userId: true } });
  if (activeAdmin) throw new Error("An active administrator already exists. No account was changed.");

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { userId: true } });
  if (existingUser) throw new Error("An account with ADMIN_EMAIL already exists. No account was changed.");

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, firstName, lastName, passwordHash, role: "admin", isActive: true },
    select: { userId: true },
  });
  console.log(`Administrator account created for ${email}. Remove ADMIN_PASSWORD from backend/.env after setup.`);
}

main()
  .catch((error) => {
    console.error(`Administrator setup failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
