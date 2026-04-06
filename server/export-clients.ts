import { PrismaClient } from '@prisma/client';

function esc(v: string | null): string {
  if (v === null || v === undefined) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

async function main() {
  const prisma = new PrismaClient();
  const clients = await prisma.client.findMany({ include: { sites: true } });

  const lines: string[] = [];
  lines.push('-- Auto-generated: inject clients + sites');
  lines.push('BEGIN;');
  lines.push('');

  for (const c of clients) {
    lines.push(
      `INSERT INTO clients (id, name, email, phone, address, notes, siret, siren, "formeJuridique", "tvaNumber", "representantLegal", "representantRole", "codeApe", "capitalSocial", rcs, "createdAt", "updatedAt") VALUES (${esc(c.id)}, ${esc(c.name)}, ${esc(c.email)}, ${esc(c.phone)}, ${esc(c.address)}, ${esc(c.notes)}, ${esc(c.siret)}, ${esc(c.siren)}, ${esc(c.formeJuridique)}, ${esc(c.tvaNumber)}, ${esc(c.representantLegal)}, ${esc(c.representantRole)}, ${esc(c.codeApe)}, ${esc(c.capitalSocial)}, ${esc(c.rcs)}, '${c.createdAt.toISOString()}', '${c.updatedAt.toISOString()}') ON CONFLICT (id) DO NOTHING;`
    );
    for (const s of c.sites) {
      lines.push(
        `INSERT INTO client_sites (id, "clientId", name, address, latitude, longitude, "geoRadius", "hourlyRate", notes, "createdAt", "updatedAt") VALUES (${esc(s.id)}, ${esc(s.clientId)}, ${esc(s.name)}, ${esc(s.address)}, ${s.latitude ?? 'NULL'}, ${s.longitude ?? 'NULL'}, ${s.geoRadius}, ${s.hourlyRate ?? 'NULL'}, ${esc(s.notes)}, '${s.createdAt.toISOString()}', '${s.updatedAt.toISOString()}') ON CONFLICT (id) DO NOTHING;`
      );
    }
  }

  lines.push('');
  lines.push('COMMIT;');
  
  const fs = await import('fs');
  fs.writeFileSync('inject-clients.sql', lines.join('\n'), 'utf-8');
  console.log(`Generated inject-clients.sql with ${clients.length} clients`);
  
  await prisma.$disconnect();
}

main();
