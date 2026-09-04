import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import coinsService from '../coins/coins.service';

class ShopService {
  // ============ TOVARLAR (ADMIN) ============

  async getAllItems() {
    return prisma.shopItem.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getActiveItems() {
    return prisma.shopItem.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  async createItem(data: { name: string; description?: string; price: number; imageUrl?: string; stock?: number | null }) {
    return prisma.shopItem.create({ data });
  }

  async updateItem(id: string, data: Partial<{ name: string; description: string; price: number; imageUrl: string; stock: number | null; isActive: boolean }>) {
    const item = await prisma.shopItem.findUnique({ where: { id } });
    if (!item) throw ApiError.notFound('Tovar topilmadi');
    return prisma.shopItem.update({ where: { id }, data });
  }

  async deleteItem(id: string) {
    const item = await prisma.shopItem.findUnique({ where: { id } });
    if (!item) throw ApiError.notFound('Tovar topilmadi');

    const orderCount = await prisma.shopOrder.count({ where: { itemId: id } });
    if (orderCount > 0) {
      // Tarixni buzmaslik uchun o'chirilmaydi — faqat nofaol qilinadi
      return prisma.shopItem.update({ where: { id }, data: { isActive: false } });
    }
    return prisma.shopItem.delete({ where: { id } });
  }

  // ============ BUYURTMA (O'QUVCHI) ============

  async createOrder(studentId: string, itemId: string) {
    const item = await prisma.shopItem.findUnique({ where: { id: itemId } });
    if (!item || !item.isActive) throw ApiError.notFound('Tovar topilmadi yoki mavjud emas');
    if (item.stock !== null && item.stock <= 0) throw ApiError.badRequest('Tovar tugagan');

    const balance = await coinsService.getBalance(studentId);
    if (balance < item.price) {
      throw ApiError.badRequest(`Coin yetarli emas — kerak: ${item.price}, mavjud: ${balance}`);
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.shopOrder.create({
        data: { studentId, itemId, priceAtOrder: item.price, status: 'kutilmoqda' },
      });
      await tx.coinTransaction.create({
        data: {
          studentId,
          amount: -item.price,
          reason: `Sovg'a buyurtmasi: ${item.name}`,
          shopOrderId: created.id,
        },
      });
      if (item.stock !== null) {
        await tx.shopItem.update({ where: { id: itemId }, data: { stock: { decrement: 1 } } });
      }
      return created;
    });

    return order;
  }

  async getMyOrders(studentId: string) {
    return prisma.shopOrder.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: { item: { select: { name: true, imageUrl: true } } },
    });
  }

  // ============ BUYURTMALAR RO'YXATI (ADMIN/KASSIR) ============

  async listOrders(filters?: { status?: string; groupId?: string; teacherId?: string; from?: string; to?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }
    if (filters?.groupId || filters?.teacherId) {
      where.student = {
        groupStudents: {
          some: {
            ...(filters.groupId ? { groupId: filters.groupId } : {}),
            ...(filters.teacherId ? { group: { teacherId: filters.teacherId } } : {}),
          },
        },
      };
    }

    const orders = await prisma.shopOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            fullName: true,
            groupStudents: {
              orderBy: { joinedAt: 'desc' },
              take: 1,
              select: { group: { select: { id: true, name: true, teacher: { select: { fullName: true } } } } },
            },
          },
        },
        item: { select: { name: true, imageUrl: true, price: true } },
        fulfilledBy: { select: { fullName: true } },
      },
    });

    const now = Date.now();
    return orders.map((o) => ({
      id: o.id,
      status: o.status,
      priceAtOrder: o.priceAtOrder,
      createdAt: o.createdAt,
      fulfilledAt: o.fulfilledAt,
      fulfilledByName: o.fulfilledBy?.fullName || null,
      cancelNote: o.cancelNote,
      daysSinceOrder: Math.floor((now - o.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      student: {
        fullName: o.student.fullName,
        groupName: o.student.groupStudents[0]?.group?.name || null,
        teacherName: o.student.groupStudents[0]?.group?.teacher?.fullName || null,
      },
      item: { name: o.item.name, imageUrl: o.item.imageUrl, price: o.item.price },
    }));
  }

  async fulfillOrder(orderId: string, fulfilledById: string) {
    const order = await prisma.shopOrder.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Buyurtma topilmadi');
    if (order.status !== 'kutilmoqda') throw ApiError.badRequest('Bu buyurtma allaqachon yakunlangan');

    return prisma.shopOrder.update({
      where: { id: orderId },
      data: { status: 'berildi', fulfilledById, fulfilledAt: new Date() },
    });
  }

  async cancelOrder(orderId: string, cancelledById: string, note?: string) {
    const order = await prisma.shopOrder.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Buyurtma topilmadi');
    if (order.status !== 'kutilmoqda') throw ApiError.badRequest('Bu buyurtma allaqachon yakunlangan');

    await prisma.$transaction(async (tx) => {
      await tx.shopOrder.update({
        where: { id: orderId },
        data: { status: 'bekor_qilindi', fulfilledById: cancelledById, fulfilledAt: new Date(), cancelNote: note || null },
      });
      await tx.coinTransaction.create({
        data: {
          studentId: order.studentId,
          amount: order.priceAtOrder,
          reason: "Bekor qilingan buyurtma uchun coin qaytarildi",
          shopOrderId: order.id,
        },
      });
      const item = await tx.shopItem.findUnique({ where: { id: order.itemId } });
      if (item?.stock !== null && item?.stock !== undefined) {
        await tx.shopItem.update({ where: { id: order.itemId }, data: { stock: { increment: 1 } } });
      }
    });

    return prisma.shopOrder.findUnique({ where: { id: orderId } });
  }
}

export default new ShopService();
