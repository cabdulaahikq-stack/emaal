import { prisma } from "../src/lib/db.js";
import { hashSecret } from "../src/lib/security.js";

async function main() {
  const phone = process.env.SEED_ADMIN_PHONE ?? "+252611000000";
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("Set SEED_ADMIN_PASSWORD before seeding the first admin account");
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    console.log(`Admin ${phone} already exists (${existing.id})`);
    return;
  }

  const passwordHash = await hashSecret(password);
  const pinHash = await hashSecret("0000");

  const admin = await prisma.user.create({
    data: { role: "ADMIN", fullName: "Emaal Admin", phone, passwordHash, pinHash },
  });
  console.log(`Created admin ${admin.phone} (${admin.id}) — PIN defaults to 0000, change it after first login`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
