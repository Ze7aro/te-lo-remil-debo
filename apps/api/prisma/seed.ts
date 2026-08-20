import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  const socioPass = await bcrypt.hash('socio123', 10);
  const platformPass = await bcrypt.hash('platform123', 10);

  await prisma.platformAdmin.upsert({
    where: { email: 'platform@clubapp.com' },
    update: { activo: true },
    create: {
      email: 'platform@clubapp.com',
      nombre: 'Superadmin ClubApp',
      password_hash: platformPass,
      activo: true,
    },
  });

  const club = await prisma.club.upsert({
    where: { slug: 'club-prueba' },
    update: {
      precio_usd_mes: 49,
      cuota_monto: 5000,
      regla_moroso_cuotas: 2,
      bloquear_reservas: true,
      bloquear_entrada: false,
      cumples_auto: true,
      max_reservas_activas: 2,
      cancelar_reserva_horas: 2,
      activo: true,
      onboarding_completo: true,
      color_primario: '#2563eb',
      color_secundario: '#0f172a',
      color_terciario: '#f59e0b',
    },
    create: {
      slug: 'club-prueba',
      nombre: 'Club Prueba',
      color_primario: '#2563eb',
      color_secundario: '#0f172a',
      color_terciario: '#f59e0b',
      plan: 'basico',
      precio_usd_mes: 49,
      cuota_monto: 5000,
      logo_url: null,
      regla_moroso_cuotas: 2,
      bloquear_reservas: true,
      bloquear_entrada: false,
      cumples_auto: true,
      max_reservas_activas: 2,
      onboarding_completo: true,
      cancelar_reserva_horas: 2,
      activo: true,
    },
  });

  await prisma.admin.upsert({
    where: {
      club_id_email: { club_id: club.id, email: 'admin@clubprueba.com' },
    },
    update: { must_change_password: false },
    create: {
      club_id: club.id,
      email: 'admin@clubprueba.com',
      password_hash: passwordHash,
      nombre: 'Admin Prueba',
      rol: 'admin',
      must_change_password: false,
    },
  });

  const sociosData = [
    {
      dni: '30111222',
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan@test.com',
      telefono: '3411111111',
      rol: 'socio',
      fecha_nacimiento: new Date('1990-08-14'),
    },
    {
      dni: '30222333',
      nombre: 'Ana',
      apellido: 'García',
      email: 'ana@test.com',
      telefono: '3412222222',
      rol: 'socio',
      fecha_nacimiento: new Date('1992-03-20'),
    },
    {
      dni: '30333444',
      nombre: 'Luis',
      apellido: 'Profe',
      email: 'profe@test.com',
      telefono: '3413333333',
      rol: 'profe',
      fecha_nacimiento: new Date('1985-11-02'),
    },
  ];

  for (const s of sociosData) {
    await prisma.socio.upsert({
      where: { club_id_dni: { club_id: club.id, dni: s.dni } },
      update: {
        fecha_nacimiento: s.fecha_nacimiento,
        telefono: s.telefono,
      },
      create: {
        club_id: club.id,
        dni: s.dni,
        nombre: s.nombre,
        apellido: s.apellido,
        email: s.email,
        telefono: s.telefono,
        password_hash: socioPass,
        estado: 'activo',
        rol: s.rol,
        fecha_nacimiento: s.fecha_nacimiento,
      },
    });
  }

  const juan = await prisma.socio.findUnique({
    where: { club_id_dni: { club_id: club.id, dni: '30111222' } },
  });
  const ana = await prisma.socio.findUnique({
    where: { club_id_dni: { club_id: club.id, dni: '30222333' } },
  });
  const luis = await prisma.socio.findUnique({
    where: { club_id_dni: { club_id: club.id, dni: '30333444' } },
  });

  if (juan) {
    await prisma.pago.upsert({
      where: { socio_id_mes: { socio_id: juan.id, mes: '2026-08' } },
      update: {},
      create: {
        club_id: club.id,
        socio_id: juan.id,
        mes: '2026-08',
        monto: 5000,
        estado: 'pagado',
        fecha_pago: new Date(),
      },
    });
  }

  if (ana) {
    await prisma.pago.upsert({
      where: { socio_id_mes: { socio_id: ana.id, mes: '2026-08' } },
      update: {},
      create: {
        club_id: club.id,
        socio_id: ana.id,
        mes: '2026-08',
        monto: 5000,
        estado: 'pendiente',
      },
    });
    // 2da cuota pendiente → dispara alerta fuga por deuda
    await prisma.pago.upsert({
      where: { socio_id_mes: { socio_id: ana.id, mes: '2026-07' } },
      update: {},
      create: {
        club_id: club.id,
        socio_id: ana.id,
        mes: '2026-07',
        monto: 5000,
        estado: 'pendiente',
      },
    });
  }

  if (juan && ana) {
    const familia = await prisma.grupoFamiliar.findFirst({
      where: { club_id: club.id, nombre: 'Familia Pérez' },
    });
    if (!familia) {
      const g = await prisma.grupoFamiliar.create({
        data: {
          club_id: club.id,
          nombre: 'Familia Pérez',
          titular_id: juan.id,
        },
      });
      await prisma.socio.updateMany({
        where: { id: { in: [juan.id, ana.id] } },
        data: { grupo_familiar_id: g.id },
      });
    }
  }

  if (luis) {
    let futbol = await prisma.actividad.findFirst({
      where: { club_id: club.id, nombre: 'Fútbol' },
    });
    if (!futbol) {
      futbol = await prisma.actividad.create({
        data: {
          club_id: club.id,
          nombre: 'Fútbol',
          modo_cobro: 'club',
          monto_adicional: 500,
          activo: true,
        },
      });
    }

    let natacion = await prisma.actividad.findFirst({
      where: { club_id: club.id, nombre: 'Natación' },
    });
    if (!natacion) {
      natacion = await prisma.actividad.create({
        data: {
          club_id: club.id,
          nombre: 'Natación',
          modo_cobro: 'profe',
          profe_id: luis.id,
          comision_tipo: 'porcentaje',
          comision_valor: 20,
          activo: true,
        },
      });
    }

    if (juan) {
      await prisma.socioActividad.upsert({
        where: {
          socio_id_actividad_id: {
            socio_id: juan.id,
            actividad_id: futbol.id,
          },
        },
        update: {},
        create: { socio_id: juan.id, actividad_id: futbol.id },
      });
    }
  }

  let padel = await prisma.espacio.findFirst({
    where: { club_id: club.id, nombre: 'Pádel 1' },
  });
  if (!padel) {
    padel = await prisma.espacio.create({
      data: {
        club_id: club.id,
        nombre: 'Pádel 1',
        tipo: 'padel',
        duracion_slot_min: 60,
        hora_apertura: '08:00',
        hora_cierre: '23:00',
      },
    });
  }

  let quincho = await prisma.espacio.findFirst({
    where: { club_id: club.id, nombre: 'Quincho grande' },
  });
  if (!quincho) {
    quincho = await prisma.espacio.create({
      data: {
        club_id: club.id,
        nombre: 'Quincho grande',
        tipo: 'quincho',
        duracion_slot_min: 120,
        hora_apertura: '10:00',
        hora_cierre: '22:00',
      },
    });
  }

  if (juan && padel) {
    const inicio = new Date();
    inicio.setHours(18, 0, 0, 0);
    const fin = new Date(inicio);
    fin.setHours(19, 0, 0, 0);
    const existing = await prisma.reserva.findFirst({
      where: {
        club_id: club.id,
        espacio_id: padel.id,
        socio_id: juan.id,
        inicio,
      },
    });
    if (!existing) {
      await prisma.reserva.create({
        data: {
          club_id: club.id,
          espacio_id: padel.id,
          socio_id: juan.id,
          inicio,
          fin,
          estado: 'confirmada',
          nota: 'Reserva demo',
        },
      });
    }
  }

  let horario = await prisma.horario.findFirst({
    where: { club_id: club.id, titulo: 'Fútbol infantil' },
  });
  if (!horario) {
    horario = await prisma.horario.create({
      data: {
        club_id: club.id,
        titulo: 'Fútbol infantil',
        dias: 'lun,mie,vie',
        hora_inicio: '18:00',
        hora_fin: '19:30',
        profe_id: luis?.id,
        activo: true,
      },
    });
  }

  const noticia = await prisma.noticia.findFirst({
    where: { club_id: club.id, titulo: 'Bienvenidos al Club Prueba' },
  });
  if (!noticia) {
    await prisma.noticia.create({
      data: {
        club_id: club.id,
        titulo: 'Bienvenidos al Club Prueba',
        cuerpo: 'Ya está online el panel de comisión. Probá socios, cobros y reservas.',
        es_evento: false,
        published: true,
      },
    });
  }

  let torneo = await prisma.torneo.findFirst({
    where: { club_id: club.id, nombre: 'Copa Verano' },
  });
  if (!torneo) {
    torneo = await prisma.torneo.create({
      data: {
        club_id: club.id,
        nombre: 'Copa Verano',
        deporte: 'fútbol',
        estado: 'activo',
      },
    });
    await prisma.partido.createMany({
      data: [
        {
          torneo_id: torneo.id,
          club_id: club.id,
          rival_a: 'Azules',
          rival_b: 'Rojos',
          jugado: true,
          goles_a: 2,
          goles_b: 1,
          fecha: new Date(),
        },
        {
          torneo_id: torneo.id,
          club_id: club.id,
          rival_a: 'Verdes',
          rival_b: 'Azules',
          jugado: false,
          fecha: new Date(Date.now() + 7 * 86400000),
        },
      ],
    });
  }

  if (horario && ana && luis) {
    const hace20 = new Date();
    hace20.setDate(hace20.getDate() - 20);
    hace20.setHours(0, 0, 0, 0);
    await prisma.asistencia.upsert({
      where: {
        horario_id_socio_id_fecha: {
          horario_id: horario.id,
          socio_id: ana.id,
          fecha: hace20,
        },
      },
      update: {},
      create: {
        club_id: club.id,
        horario_id: horario.id,
        socio_id: ana.id,
        fecha: hace20,
        estado: 'ausente',
        marcada_por: luis.id,
      },
    });
    const hace10 = new Date();
    hace10.setDate(hace10.getDate() - 10);
    hace10.setHours(0, 0, 0, 0);
    await prisma.asistencia.upsert({
      where: {
        horario_id_socio_id_fecha: {
          horario_id: horario.id,
          socio_id: ana.id,
          fecha: hace10,
        },
      },
      update: {},
      create: {
        club_id: club.id,
        horario_id: horario.id,
        socio_id: ana.id,
        fecha: hace10,
        estado: 'ausente',
        marcada_por: luis.id,
      },
    });
  }

  console.log('Seed OK: Club Prueba (slug: club-prueba)');
  console.log('Platform: platform@clubapp.com / platform123 → /login');
  console.log('Admin: admin@clubprueba.com / admin123 → /login/club-prueba');
  console.log('Socios pass: socio123 (DNI 30111222, 30222333, 30333444)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
