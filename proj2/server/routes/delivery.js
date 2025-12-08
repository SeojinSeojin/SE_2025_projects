const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/firebase');
const User = require('../models/User');
const { awardPointsForOrder } = require('./points');
const { updateCustomerBadges } = require('../services/badgeService');

const router = express.Router();

// Get delivery profile by email and password
router.post('/profile', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const user = await User.findByEmail(email);

    if (!user || user.password !== password || user.role !== 'delivery') {
      return res.status(401).json({ error: 'Invalid credentials or not a delivery rider' });
    }

    res.json({
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Get delivery profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get assigned orders for delivery rider
router.get('/orders', async (req, res) => {
  try {
    const { riderId } = req.query;

    if (!riderId) {
      return res.status(400).json({ error: 'Rider ID required' });
    }

    // Get orders assigned to this rider
    const ordersSnapshot = await db.collection('orders')
      .where('deliveryPartnerId', '==', riderId)
      .get();

    const orders = ordersSnapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
      const updatedAt = data.updatedAt?.toDate?.() || new Date(data.updatedAt);
      const assignedAt = data.assignedAt?.toDate?.() || (data.assignedAt ? new Date(data.assignedAt) : null);
      const pickedUpAt = data.pickedUpAt?.toDate?.() || (data.pickedUpAt ? new Date(data.pickedUpAt) : null);
      const deliveredAt = data.deliveredAt?.toDate?.() || (data.deliveredAt ? new Date(data.deliveredAt) : null);
      const confirmedAt = data.confirmedAt?.toDate?.() || (data.confirmedAt ? new Date(data.confirmedAt) : null);
      const readyAt = data.readyAt?.toDate?.() || (data.readyAt ? new Date(data.readyAt) : null);
      const deliveryFee = Number(data.deliveryFee) || 0;
      const tipAmount = Number(data.tipAmount) || 0;
      const earning = deliveryFee + tipAmount;

      return {
        id: doc.id,
        ...data,
        deliveryFee,
        tipAmount,
        earning,
        createdAt,
        updatedAt,
        assignedAt,
        pickedUpAt,
        deliveredAt,
        confirmedAt,
        readyAt,
      };
    });

    res.json({ orders });
  } catch (error) {
    console.error('Get delivery orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Accept delivery assignment (first-come-first-serve)
router.post('/accept/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { riderId } = req.body;

    console.log(`Accept order request: orderId=${orderId}, riderId=${riderId}`);

    if (!riderId) {
      return res.status(400).json({ error: 'Rider ID required' });
    }

    // Check if order is still available (not assigned to another rider)
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDoc.data();
    console.log(`Order data: status=${orderData.status}, deliveryPartnerId=${orderData.deliveryPartnerId}`);

    // Check if order is still available for assignment
    if (orderData.deliveryPartnerId && orderData.deliveryPartnerId !== null) {
      console.log(`Order ${orderId} already assigned to ${orderData.deliveryPartnerId}`);
      return res.status(409).json({ error: 'Order has already been assigned to another rider' });
    }

    if (orderData.status !== 'ready') {
      console.log(`Order ${orderId} status is ${orderData.status}, not ready`);
      return res.status(400).json({ error: 'Order is not ready for delivery' });
    }

    // Check if rider exists
    const rider = await User.findById(riderId);
    if (!rider) {
      console.log(`Rider ${riderId} not found`);
      return res.status(400).json({ error: 'Rider not found' });
    }

    // Check if rider already has active orders (prevent multiple orders)
    const activeOrdersSnapshot = await db.collection('orders')
      .where('deliveryPartnerId', '==', riderId)
      .where('status', 'in', ['ready', 'out_for_delivery'])
      .get();

    if (!activeOrdersSnapshot.empty) {
      console.log(`Rider ${riderId} already has ${activeOrdersSnapshot.docs.length} active orders`);
      return res.status(400).json({ error: 'You already have an active order. Complete it before accepting another.' });
    }

    console.log(`Assigning order ${orderId} to rider ${riderId}`);

    // Assign order to rider (first-come-first-serve)
    const orderRef = db.collection('orders').doc(orderId);
    await orderRef.update({
      status: 'out_for_delivery',
      deliveryPartnerId: riderId,
      assignedAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`Order ${orderId} successfully assigned to rider ${riderId}`);

    // Don't update rider status to busy - allow multiple orders
    // await rider.updateDeliveryStatus('busy');

    res.json({
      message: 'Order accepted successfully',
      orderId: orderId,
      status: 'out_for_delivery'
    });
  } catch (error) {
    console.error('Accept delivery error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reject delivery assignment (remove assignment, make available again)
router.post('/reject/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { riderId } = req.body;

    if (!riderId) {
      return res.status(400).json({ error: 'Rider ID required' });
    }

    // Remove rider assignment - order becomes available for other riders
    const orderRef = db.collection('orders').doc(orderId);
    await orderRef.update({
      deliveryPartnerId: null,
      assignedAt: null,
      status: 'ready', // Reset to ready status
      updatedAt: new Date()
    });

    res.json({
      message: 'Order rejected, now available for other riders',
      orderId: orderId
    });
  } catch (error) {
    console.error('Reject delivery error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark order as picked up
router.post('/pickup/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { riderId } = req.body;

    if (!riderId) {
      return res.status(400).json({ error: 'Rider ID required' });
    }

    // Update order status
    const orderRef = db.collection('orders').doc(orderId);
    await orderRef.update({
      status: 'out_for_delivery',
      pickedUpAt: new Date(),
      updatedAt: new Date()
    });

    res.json({
      message: 'Order picked up successfully',
      orderId: orderId,
      status: 'out_for_delivery'
    });
  } catch (error) {
    console.error('Pickup order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark order as delivered
router.post('/deliver/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { riderId } = req.body;

    if (!riderId) {
      return res.status(400).json({ error: 'Rider ID required' });
    }

    // Get order details first
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDoc.data();
    const orderTotal = orderData.totalAmount || 0; // The total paid by the customer
    const deliveryFee = Number(orderData.deliveryFee) || 0;
    const tipAmount = Number(orderData.tipAmount) || 0;

    // Delivery partner earning is delivery fee + full tip
    const earning = deliveryFee + tipAmount;

    // 2. Update order status
    const orderRef = db.collection('orders').doc(orderId);
    await orderRef.update({
      status: 'delivered',
      deliveredAt: new Date(),
      updatedAt: new Date()
    });

    // 3. Award points to customer
    await awardPointsForOrder(orderData.customerId, orderTotal); // Use orderTotal for points

    // Refresh customer badges based on updated order history
    try {
      await updateCustomerBadges(orderData.customerId);
    } catch (badgeError) {
      console.error('Failed to update customer badges:', badgeError);
    }

    // Check if rider has other active orders before setting to free
    // 4. CREDIT RIDER EARNINGS WITH COMMISSION AND TIP
    const rider = await User.findById(riderId);
    if (rider) {
      await rider.updateEarnings(earning); // <--- CREDIT RIDER

      // Check if rider has other active orders before setting to free
      const activeOrdersSnapshot = await db.collection('orders')
        .where('deliveryPartnerId', '==', riderId)
        .where('status', 'in', ['ready', 'out_for_delivery'])
        .get();

      // Only set to free if no other active orders
      if (activeOrdersSnapshot.empty) {
        await rider.updateDeliveryStatus('free');
      }
    } else {
      console.warn(`Rider ${riderId} not found during delivery payout.`);
    }

    res.json({
      message: 'Order delivered successfully',
      orderId: orderId,
      status: 'delivered',
      earning,
      deliveryFee,
      tipAmount
    });
  } catch (error) {
    console.error('Deliver order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available orders for assignment
router.get('/available', async (req, res) => {
  try {
    console.log('Fetching available orders...');

    // Get orders that are ready but not yet assigned
    // We need to get all ready orders and filter out those with deliveryPartnerId
    const ordersSnapshot = await db.collection('orders')
      .where('status', '==', 'ready')
      .get();

    console.log(`Found ${ordersSnapshot.docs.length} orders with status 'ready'`);

    // Filter orders that don't have a deliveryPartnerId or have it as null
    const orders = ordersSnapshot.docs
      .map(doc => {
        const data = doc.data();
        console.log(`Order ${doc.id}: deliveryPartnerId = ${data.deliveryPartnerId}`);
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date()
        };
      })
      .filter(order => !order.deliveryPartnerId);

    console.log(`Returning ${orders.length} available orders`);
    res.json({ orders });
  } catch (error) {
    console.error('Get available orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;