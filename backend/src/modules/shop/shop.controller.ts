import { Request, Response, NextFunction } from 'express';
import shopService from './shop.service';

class ShopController {
  /** GET /api/shop/items — admin: hammasi, boshqalar: faqat faol */
  async getItems(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = req.user?.role === 'admin';
      const items = isAdmin ? await shopService.getAllItems() : await shopService.getActiveItems();
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/shop/items — admin */
  async createItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description, price, stock } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, message: 'Nomi majburiy' });
      }
      const priceNum = Number(price);
      if (!Number.isInteger(priceNum) || priceNum <= 0) {
        return res.status(400).json({ success: false, message: "Narx musbat butun son bo'lishi kerak" });
      }
      const imageUrl = req.file ? `/uploads/shop-items/${req.file.filename}` : undefined;
      const item = await shopService.createItem({
        name: name.trim(),
        description: description || undefined,
        price: priceNum,
        imageUrl,
        stock: stock !== undefined && stock !== '' ? Number(stock) : null,
      });
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }

  /** PUT /api/shop/items/:id — admin */
  async updateItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description, price, stock, isActive } = req.body;
      const data: any = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (price !== undefined) data.price = Number(price);
      if (stock !== undefined) data.stock = stock === '' || stock === null ? null : Number(stock);
      if (isActive !== undefined) data.isActive = isActive === true || isActive === 'true';
      if (req.file) data.imageUrl = `/uploads/shop-items/${req.file.filename}`;

      const item = await shopService.updateItem(req.params.id, data);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /api/shop/items/:id — admin */
  async deleteItem(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await shopService.deleteItem(req.params.id);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/shop/orders — o'quvchi buyurtma beradi */
  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.body;
      if (!itemId) return res.status(400).json({ success: false, message: 'itemId majburiy' });
      const order = await shopService.createOrder(req.user!.userId, itemId);
      res.status(201).json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/shop/orders/mine — o'quvchining o'z buyurtmalari */
  async getMyOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const orders = await shopService.getMyOrders(req.user!.userId);
      res.json({ success: true, data: orders });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/shop/orders — admin/kassir, filtrlar bilan */
  async listOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, groupId, teacherId, from, to } = req.query as Record<string, string | undefined>;
      const orders = await shopService.listOrders({ status, groupId, teacherId, from, to });
      res.json({ success: true, data: orders });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/shop/orders/:id/fulfill — kassir/admin sovg'ani berdi */
  async fulfillOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await shopService.fulfillOrder(req.params.id, req.user!.userId);
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/shop/orders/:id/cancel — kassir/admin bekor qildi (coin qaytariladi) */
  async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await shopService.cancelOrder(req.params.id, req.user!.userId, req.body?.note);
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }
}

export default new ShopController();
