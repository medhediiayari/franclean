import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Suppression des données (les utilisateurs sont conservés)...');

  await prisma.agentPayment.deleteMany();
  console.log('  ✓ Paiements supprimés');

  await prisma.attendance.deleteMany();
  console.log('  ✓ Attendance supprimés');

  await prisma.eventHistory.deleteMany();
  console.log('  ✓ EventHistory supprimés');

  await prisma.eventAgent.deleteMany();
  console.log('  ✓ EventAgent supprimés');

  await prisma.eventShift.deleteMany();
  console.log('  ✓ EventShift supprimés');

  await prisma.event.deleteMany();
  console.log('  ✓ Events supprimés');

  console.log('✅ Base vidée. Les utilisateurs ont été conservés.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
