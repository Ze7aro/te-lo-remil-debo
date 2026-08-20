import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { UpdateClubConfigDto } from './dto/update-club-config.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';

const CLUB_PUBLIC_SELECT = {
  id: true,
  slug: true,
  nombre: true,
  logo_url: true,
  color_primario: true,
  color_secundario: true,
  color_terciario: true,
  cuota_monto: true,
  plan: true,
  activo: true,
  onboarding_completo: true,
  cuit: true,
  cuil: true,
  titular_nombre: true,
  titular_apellido: true,
  direccion: true,
  telefono_club: true,
  email_contacto: true,
  regla_moroso_cuotas: true,
  bloquear_reservas: true,
  bloquear_entrada: true,
  cumples_auto: true,
  max_reservas_activas: true,
  cancelar_reserva_horas: true,
} as const;

const CLUB_LOGIN_SELECT = {
  id: true,
  slug: true,
  nombre: true,
  logo_url: true,
  color_primario: true,
  color_secundario: true,
  color_terciario: true,
  activo: true,
} as const;

@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  buscar(q: string) {
    const texto = q.trim();
    return this.prisma.club.findMany({
      where: {
        activo: true,
        ...(texto
          ? {
              OR: [
                { nombre: { contains: texto, mode: 'insensitive' as const } },
                { slug: { contains: texto, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        nombre: true,
        logo_url: true,
        color_primario: true,
        color_secundario: true,
        color_terciario: true,
      },
      take: 200,
      orderBy: { nombre: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const club = await this.prisma.club.findUnique({
      where: { slug },
      select: CLUB_LOGIN_SELECT,
    });
    if (!club) throw new NotFoundException('Club no encontrado');
    return club;
  }

  async findById(id: number) {
    const club = await this.prisma.club.findUnique({
      where: { id },
      select: CLUB_PUBLIC_SELECT,
    });
    if (!club) throw new NotFoundException('Club no encontrado');
    return club;
  }

  async updateConfig(clubId: number, dto: UpdateClubConfigDto) {
    await this.findById(clubId);
    return this.prisma.club.update({
      where: { id: clubId },
      data: {
        ...(dto.nombre !== undefined && { nombre: dto.nombre }),
        ...(dto.logo_url !== undefined && { logo_url: dto.logo_url }),
        ...(dto.color_primario !== undefined && {
          color_primario: dto.color_primario,
        }),
        ...(dto.color_secundario !== undefined && {
          color_secundario: dto.color_secundario || null,
        }),
        ...(dto.color_terciario !== undefined && {
          color_terciario: dto.color_terciario || null,
        }),
        ...(dto.cuota_monto !== undefined && { cuota_monto: dto.cuota_monto }),
        ...(dto.regla_moroso_cuotas !== undefined && {
          regla_moroso_cuotas: dto.regla_moroso_cuotas,
        }),
        ...(dto.bloquear_reservas !== undefined && {
          bloquear_reservas: dto.bloquear_reservas,
        }),
        ...(dto.bloquear_entrada !== undefined && {
          bloquear_entrada: dto.bloquear_entrada,
        }),
        ...(dto.cumples_auto !== undefined && {
          cumples_auto: dto.cumples_auto,
        }),
        ...(dto.max_reservas_activas !== undefined && {
          max_reservas_activas: dto.max_reservas_activas,
        }),
        ...(dto.cancelar_reserva_horas !== undefined && {
          cancelar_reserva_horas: dto.cancelar_reserva_horas,
        }),
      },
      select: CLUB_PUBLIC_SELECT,
    });
  }

  async completeOnboarding(
    clubId: number,
    adminId: number,
    dto: CompleteOnboardingDto,
  ) {
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) throw new NotFoundException('Club no encontrado');
    if (club.onboarding_completo) {
      throw new BadRequestException('El onboarding ya está completo');
    }

    const password_hash = await bcrypt.hash(dto.nueva_password, 10);

    await this.prisma.$transaction([
      this.prisma.club.update({
        where: { id: clubId },
        data: {
          onboarding_completo: true,
          titular_nombre: dto.titular_nombre.trim(),
          titular_apellido: dto.titular_apellido.trim(),
          cuit: dto.cuit.trim(),
          cuil: dto.cuil.trim(),
          ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
          ...(dto.direccion !== undefined && { direccion: dto.direccion }),
          ...(dto.telefono_club !== undefined && {
            telefono_club: dto.telefono_club,
          }),
          ...(dto.email_contacto !== undefined && {
            email_contacto: dto.email_contacto.toLowerCase(),
          }),
          ...(dto.logo_url !== undefined && { logo_url: dto.logo_url || null }),
          ...(dto.color_primario !== undefined && {
            color_primario: dto.color_primario,
          }),
          ...(dto.color_secundario !== undefined && {
            color_secundario: dto.color_secundario || null,
          }),
          ...(dto.color_terciario !== undefined && {
            color_terciario: dto.color_terciario || null,
          }),
          ...(dto.cuota_monto !== undefined && { cuota_monto: dto.cuota_monto }),
        },
      }),
      this.prisma.admin.update({
        where: { id: adminId },
        data: {
          password_hash,
          must_change_password: false,
          nombre: `${dto.titular_nombre.trim()} ${dto.titular_apellido.trim()}`,
        },
      }),
    ]);

    return this.findById(clubId);
  }

  async uploadLogo(clubId: number, file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Elegí una imagen');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('El logo no puede superar 2 MB');
    }
    if (!this.media.extForMime(file.mimetype)) {
      throw new BadRequestException('Solo JPG, PNG, WEBP o GIF');
    }

    await this.findById(clubId);
    const logo_url = await this.media.saveClubLogo(clubId, file);

    return this.prisma.club.update({
      where: { id: clubId },
      data: { logo_url },
      select: CLUB_PUBLIC_SELECT,
    });
  }
}
