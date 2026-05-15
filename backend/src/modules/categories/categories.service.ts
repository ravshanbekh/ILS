import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { CreateCategoryInput, UpdateCategoryInput } from './categories.validation';

class CategoriesService {
  async getAll() {
    return prisma.category.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(data: CreateCategoryInput) {
    const existing = await prisma.category.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      throw ApiError.badRequest("Bunday nomdagi kategoriya allaqachon mavjud");
    }

    return prisma.category.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  async update(id: string, data: UpdateCategoryInput) {
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Kategoriya topilmadi");

    if (data.name && data.name !== existing.name) {
      const nameExists = await prisma.category.findUnique({
        where: { name: data.name },
      });
      if (nameExists) {
        throw ApiError.badRequest("Bunday nomdagi kategoriya allaqachon mavjud");
      }
    }

    return prisma.category.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Kategoriya topilmadi");

    return prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export default new CategoriesService();
