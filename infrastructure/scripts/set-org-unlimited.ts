import { prisma } from '@autotube/database';

async function main() {
  const email = (process.argv[2] ?? process.env.DEFAULT_ADMIN_EMAIL ?? 'adripardo72@gmail.com').toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No existe usuario con email ${email}`);
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    select: { organizationId: true },
  });

  if (memberships.length === 0) {
    throw new Error(`El usuario ${email} no pertenece a ninguna organización`);
  }

  const unlimitedLimits = {
    maxChannels: null,
    maxVideosPerMonth: null,
    maxPipelinesPerDay: null,
    unlimited: true,
  };

  for (const { organizationId } of memberships) {
    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: 'unlimited',
        planLimits: unlimitedLimits,
        trialEndsAt: null,
      },
      select: { id: true, name: true, plan: true, planLimits: true },
    });
    console.log(`✅ Organización sin límites: ${org.name} (${org.id})`);
    console.log(`   plan: ${org.plan}  planLimits: ${JSON.stringify(org.planLimits)}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
