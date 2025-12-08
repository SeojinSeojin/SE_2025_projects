const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/firebase');
const User = require('../models/User');

const router = express.Router();

// Helper function to assign rider to order
async function assignRiderToOrder(orderId) {
  try {
    const freeRiders = await User.findFreeRiders();
    if (freeRiders.length > 0) {
      const rider = freeRiders[0];
      const orderRef = db.collection('orders').doc(orderId);
      await orderRef.update({
        deliveryPartnerId: rider.id,
        assignedAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`Order ${orderId} assigned to rider ${rider.id}`);
      return rider;
    } else {
      console.log(`No free riders available for order ${orderId}`);
      return null;
    }
  } catch (error) {
    console.error('Error assigning rider:', error);
    return null;
  }
}

// Create new order (Customer only)
router.post('/', [
  body('restaurantId').notEmpty(),
  body('items').isArray({ min: 1 }),
  body('totalAmount').isNumeric(),
  body('deliveryAddress').isObject(),
  body('customerId').notEmpty(),
  body('tipAmount').optional().isNumeric(),
  body('deliveryFee').optional().isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // const { restaurantId, items, totalAmount, deliveryAddress, customerId } = req.body;
    const { restaurantId, items, totalAmount, deliveryAddress, customerId, tipAmount, deliveryFee } = req.body;

    const normalizedTip = Number(tipAmount) || 0;
    const normalizedDeliveryFee = Number(deliveryFee) || 0;

    // Create order in Firebase
    const orderRef = db.collection('orders').doc();
    const order = {
      id: orderRef.id,
      customerId,
      restaurantId,
      items,
      totalAmount,
      tipAmount: normalizedTip,
      deliveryFee: normalizedDeliveryFee,
      deliveryAddress,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await orderRef.set(order);

    res.status(201).json({
      message: 'Order created successfully',
      order: order
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get customer orders
router.get('/customer', async (req, res) => {
  try {
    // Get customerId from query parameter
    const { customerId } = req.query;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' });
    }

    // Get orders for this customer
    const ordersSnapshot = await db.collection('orders')
      .where('customerId', '==', customerId)
      .get();

    const orders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
      deliveredAt: doc.data().deliveredAt?.toDate?.() || (doc.data().deliveredAt ? new Date(doc.data().deliveredAt) : null),
    }));

    res.json({ orders });
  } catch (error) {
    console.error('Get customer orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get restaurant orders
router.get('/restaurant', async (req, res) => {
  try {
    // Get restaurantId from query parameter
    const { restaurantId } = req.query;

    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID required' });
    }

    // Get orders for this restaurant
    const ordersSnapshot = await db.collection('orders')
      .where('restaurantId', '==', restaurantId)
      .get();

    const orders = ordersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
        confirmedAt: data.confirmedAt?.toDate?.() || (data.confirmedAt ? new Date(data.confirmedAt) : null),
        readyAt: data.readyAt?.toDate?.() || (data.readyAt ? new Date(data.readyAt) : null),
      };
    });

    res.json({ orders });
  } catch (error) {
    console.error('Get restaurant orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get delivery partner orders
router.get('/delivery', async (req, res) => {
  try {
    // Return empty array until orders are implemented
    res.json({ orders: [] });
  } catch (error) {
    console.error('Get delivery orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get order by ID (mock data for now)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const mockOrder = {
      id,
      customerId: 'customer123',
      restaurantId: 'restaurant1',
      items: [
        { name: 'Pizza', price: 12.99, quantity: 1 }
      ],
      totalAmount: 12.99,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    res.json({ order: mockOrder });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update order status
router.put('/:id/status', [
  body('status').isIn(['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;

    // Update order status in Firebase
    const orderRef = db.collection('orders').doc(id);
    const timestamp = new Date()
    
    await orderRef.update({
      status: status,
      updatedAt: new Date(),
      ...(status === 'preparing' ? { confirmedAt: timestamp } : status === 'ready'? { readyAt: timestamp }:{}),
    });

    // When order is marked as ready, it becomes available for riders to accept
    // No automatic assignment - riders will see it in their available orders list

    res.json({
      message: 'Order status updated successfully',
      orderId: id,
      status: status
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Assign delivery partner (mock for now)
router.put('/:id/assign-delivery', [
  body('deliveryPartnerId').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { deliveryPartnerId } = req.body;

    // Mock response
    res.json({
      message: 'Delivery partner assigned successfully',
      orderId: id,
      deliveryPartnerId: deliveryPartnerId
    });
  } catch (error) {
    console.error('Assign delivery error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rate order
router.post('/:id/rate', [
  body('rating').isInt({ min: 1, max: 5 }),
  body('review').optional().isString(),
  body('customerId').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { rating, review, customerId } = req.body;

    // Get order to verify it belongs to customer and is delivered
    const orderDoc = await db.collection('orders').doc(id).get();
    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDoc.data();

    // Verify order belongs to customer and is delivered
    if (orderData.customerId !== customerId) {
      return res.status(403).json({ error: 'Order does not belong to this customer' });
    }

    if (orderData.status !== 'delivered') {
      return res.status(400).json({ error: 'Can only rate delivered orders' });
    }

    // Check if already rated
    if (orderData.ratings && orderData.ratings.customer) {
      return res.status(400).json({ error: 'Order already rated' });
    }

    // Update order with rating
    const orderRef = db.collection('orders').doc(id);
    const ratingData = {
      customer: {
        rating: rating,
        review: review || '',
        ratedAt: new Date()
      }
    };

    await orderRef.update({
      ratings: ratingData,
      updatedAt: new Date()
    });

    res.json({
      message: 'Rating submitted successfully',
      orderId: id,
      rating: rating,
      review: review
    });
  } catch (error) {
    console.error('Rate order error:', error);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;