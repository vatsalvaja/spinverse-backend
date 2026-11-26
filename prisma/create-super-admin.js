/**
 * Creates the first SUPER_ADMIN account (or promotes an existing ADMIN). Run it manually, once, after applying the
 * migrations:
 *
 *   SUPER_ADMIN_EMAIL=owner@example.com SUPER_ADMIN_PASSWORD='ChooseAStr0ngOne' npm run prisma:create-super-admin
 *
 * (or put SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD in your local `.env`, run the script, then delete them again).
 *
 * There are NO default credentials anywhere in the backend: the e-mail and password come only from the environment
 * of whoever runs this script, and only a bcrypt hash is stored. From then on the Super Admin creates Masters
 * through the API (POST /api/v1/super-admin/masters) and Masters create Clients.
 *
 * Behaviour (safe to run repeatedly):
 *  - no account with that e-mail  -> a SUPER_ADMIN is created;
 *  - it is already a SUPER_ADMIN  -> nothing changes (the password is NOT overwritten);
 *  - it is an existing ADMIN      -> promoted to SUPER_ADMIN (the password is kept), so an existing platform owner
 *                                    keeps the same login;
 *  - any other role (USER, MASTER, CLIENT) -> refused, so players and hierarchy accounts are never changed by accident.
 */
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

try {
  process.loadEnvFile('.env'); // Node >= 20.12; a missing file simply means "use the real environment"
} catch {}

const prisma = new PrismaClient();

const fail = (message) => {
  console.error(`create-super-admin: ${message}`);
  process.exitCode = 1;
};

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || '';
  const name = (process.env.SUPER_ADMIN_NAME || 'Super Admin').trim();
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

  if (!email || !password) {
    return fail('set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD (there are no built-in defaults).');
  }
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return fail('SUPER_ADMIN_EMAIL is not a valid e-mail address.');
  if (name.length < 2 || name.length > 100) return fail('SUPER_ADMIN_NAME must be 2-100 characters.');
  if (password.length < 8 || password.length > 72 || !/^(?=.*[A-Za-z])(?=.*\d).+$/.test(password)) {
    return fail('SUPER_ADMIN_PASSWORD must be 8-72 characters with at least one letter and one number.');
  }
  if (!Number.isInteger(rounds) || rounds < 10 || rounds > 15) return fail('BCRYPT_SALT_ROUNDS must be an integer from 10 to 15.');

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    const created = await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, rounds), role: 'SUPER_ADMIN' },
      select: { id: true, email: true },
    });
    console.log(`Created SUPER_ADMIN ${created.email} (${created.id}).`);
    return;
  }

  if (existing.role === 'SUPER_ADMIN') {
    console.log(`${email} is already a SUPER_ADMIN. Nothing changed.`);
    return;
  }
  if (existing.role === 'ADMIN') {
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'SUPER_ADMIN', isActive: true } });
    console.log(`Promoted existing ADMIN ${email} to SUPER_ADMIN (password unchanged).`);
    return;
  }
  return fail(`${email} is an existing ${existing.role} account and will not be converted. Use a different e-mail.`);
}

main()
  .catch((error) => {
    console.error('create-super-admin failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
