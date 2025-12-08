import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import './OrderManagement.css';

interface Order {
  id: string;
  customerId: string;
  restaurantId: string;
  deliveryPartnerId: string;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  totalAmount: number;
  tipAmount: number;
  deliveryFee?: number;
  earning?: number;
  deliveryAddress: any;
  status: string;
  assignedAt: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const getOrderEarning = (order: Order): number => {
  const deliveryFee = typeof order.deliveryFee === 'number' ? order.deliveryFee : 0;
  const tipAmount = typeof order.tipAmount === 'number' ? order.tipAmount : 0;
  if (typeof order.earning === 'number') {
    return order.earning;
  }
  return deliveryFee + tipAmount;
};

const OrderManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get assigned orders for this rider
  const { data: assignedOrders = [] } = useQuery<Order[]>({
    queryKey: ['deliveryOrders', user?.id],
    queryFn: async () => {
      const response = await api.get(`/delivery/orders?riderId=${user?.id}`);
      return response.data.orders;
    },
    enabled: !!user,
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchOnWindowFocus: true
  });

  // Get available orders that can be accepted
  const { data: availableOrders = [] } = useQuery<Order[]>({
    queryKey: ['availableOrders'],
    queryFn: async () => {
      console.log('OrderManagement: Fetching available orders...');
      const response = await api.get('/delivery/available');
      console.log('OrderManagement: Available orders response:', response.data);
      return response.data.orders;
    },
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchOnWindowFocus: true
  });

  // Accept order mutation
  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      console.log('Mutation: Accepting order', orderId, 'for rider', user?.id);
      const response = await api.post(`/delivery/accept/${orderId}`, {
        riderId: user?.id
      });
      console.log('Mutation: Accept response', response.data);
      return response.data;
    },
    onSuccess: (data) => {
      console.log('Mutation: Success', data);
      queryClient.invalidateQueries({ queryKey: ['deliveryOrders'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      // Invalidate available orders after a short delay to allow server processing
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['availableOrders'] });
      }, 1000);
      alert('Order accepted successfully!');
    },
    onError: (error: any) => {
      console.error('Mutation: Accept order error:', error);
      if (error.response?.status === 409) {
        alert('This order has already been taken by another rider!');
      } else if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.error || 'You are not available or the order is not ready.';
        alert(errorMessage);
      } else {
        alert('Failed to accept order: ' + (error.response?.data?.error || 'Unknown error'));
      }
    }
  });

  // Reject order mutation
  const rejectOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await api.post(`/delivery/reject/${orderId}`, {
        riderId: user?.id
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryOrders'] });
      alert('Order rejected successfully');
    },
    onError: (error: any) => {
      console.error('Reject order error:', error);
      alert('Failed to reject order: ' + (error.response?.data?.error || 'Unknown error'));
    }
  });

  // Pickup order mutation
  const pickupOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await api.post(`/delivery/pickup/${orderId}`, {
        riderId: user?.id
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryOrders'] });
    }
  });

  // Deliver order mutation
  const deliverOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await api.post(`/delivery/deliver/${orderId}`, {
        riderId: user?.id
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryOrders'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    }
  });

  const handleAcceptOrder = (orderId: string) => {
    console.log('Accepting order:', orderId);
    acceptOrderMutation.mutate(orderId);
  };

  const handleRejectOrder = (orderId: string) => {
    rejectOrderMutation.mutate(orderId);
  };

  const handlePickupOrder = (orderId: string) => {
    pickupOrderMutation.mutate(orderId);
  };

  const handleDeliverOrder = (orderId: string) => {
    deliverOrderMutation.mutate(orderId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return '#ff9800';
      case 'out_for_delivery': return '#2196f3';
      case 'delivered': return '#4caf50';
      default: return '#757575';
    }
  };

  const readyOrders = assignedOrders.filter(order => order.status === 'ready');
  const outForDeliveryOrders = assignedOrders.filter(order => order.status === 'out_for_delivery');
  const completedOrders = assignedOrders.filter(order => order.status === 'delivered');

  // Check if rider has any active orders (ready or out_for_delivery)
  const hasActiveOrders = assignedOrders.some(order =>
    ['ready', 'out_for_delivery'].includes(order.status)
  );

  return (
    <div className="delivery-order-management">
      <h1>Order Management</h1>
      <p>Manage your delivery assignments and track order progress.</p>

      {/* Available Orders - Can Accept */}
      <div className="orders-section">
        <h2>Available Orders ({availableOrders.length}) - First Come, First Serve!</h2>
        <p className="section-description">These orders are ready for pickup. Click "Accept Order" to claim them before other riders do!</p>
        {hasActiveOrders && (
          <div className="restriction-notice">
            <p><strong>⚠️ You have an active order. Complete it before accepting another.</strong></p>
          </div>
        )}
        {availableOrders.length === 0 ? (
          <p className="no-orders">No orders available for pickup</p>
        ) : (
          <div className="orders-list">
            {availableOrders.map((order) => (
              <div key={order.id} className="order-card available">
                <div className="order-header">
                  <h3>Order #{order.id.slice(-6)}</h3>
                  <span
                    className="order-status"
                    style={{ color: getStatusColor(order.status) }}
                  >
                    {order.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                <div className="order-items">
                  <h4>Items (${order.totalAmount.toFixed(2)}):</h4>
                  <ul>
                    {order.items.map((item: any, index: number) => (
                      <li key={index}>
                        {item.quantity}x {item.name} - ${item.price.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ADD TIP DISPLAY */}
                {order.tipAmount > 0 && (
                  <div className="order-tip">
                    <p><strong>Delivery Tip:</strong> ${order.tipAmount.toFixed(2)}</p>
                  </div>
                )}

                <div className="order-actions">
                  <button
                    className="btn btn-success"
                    onClick={() => {
                      console.log('Button clicked for order:', order.id);
                      handleAcceptOrder(order.id);
                    }}
                    disabled={acceptOrderMutation.isPending || hasActiveOrders}
                  >
                    {acceptOrderMutation.isPending ? 'Accepting...' :
                      hasActiveOrders ? 'Complete current order first' : 'Accept Order'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Out for Delivery Orders */}
      <div className="orders-section">
        <h2>Out for Delivery ({outForDeliveryOrders.length})</h2>
        {outForDeliveryOrders.length === 0 ? (
          <p className="no-orders">No orders out for delivery</p>
        ) : (
          <div className="orders-list">
            {outForDeliveryOrders.map((order) => (
              <div key={order.id} className="order-card out-for-delivery">
                <div className="order-header">
                  <h3>Order #{order.id.slice(-6)}</h3>
                  <span
                    className="order-status"
                    style={{ color: getStatusColor(order.status) }}
                  >
                    {order.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                <div className="order-items">
                  <h4>Items (${order.totalAmount.toFixed(2)}):</h4>
                  <ul>
                    {order.items.map((item, index) => (
                      <li key={index}>
                        {item.quantity}x {item.name} - ${item.price.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ADD TIP DISPLAY */}
                {order.tipAmount > 0 && (
                  <div className="order-tip">
                    <p><strong>Tip Earned:</strong> ${order.tipAmount.toFixed(2)}</p>
                  </div>
                )}

                <div className="delivery-address">
                  <h4>Delivery Address:</h4>
                  <p>
                    {order.deliveryAddress.street}<br />
                    {order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.zipCode}
                  </p>
                </div>

                <div className="order-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => handleDeliverOrder(order.id)}
                    disabled={deliverOrderMutation.isPending}
                  >
                    Mark as Delivered
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Orders */}
      <div className="orders-section">
        <h2>Delivery History ({completedOrders.length})</h2>
        {completedOrders.length === 0 ? (
          <p className="no-orders">No completed deliveries</p>
        ) : (
          <div className="orders-list">
            {completedOrders.map((order) => (
              <div key={order.id} className="order-card completed">
                <div className="order-header">
                  <h3>Order #{order.id.slice(-6)}</h3>
                  <span
                    className="order-status"
                    style={{ color: getStatusColor(order.status) }}
                  >
                    {order.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                <div className="order-items">
                  <h4>Items (${order.totalAmount.toFixed(2)}):</h4>
                  <ul>
                    {order.items.map((item, index) => (
                      <li key={index}>
                        {item.quantity}x {item.name} - ${item.price.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="delivery-address">
                  <h4>Delivery Address:</h4>
                  <p>
                    {order.deliveryAddress.street}<br />
                    {order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.zipCode}
                  </p>
                </div>

                <div className="order-time">
                  <p><strong>Delivered:</strong> {order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : 'Not delivered yet'}</p>

                  {/* UPDATE EARNINGS CALCULATION */}
                  <p>
                    <strong>Earnings:</strong> $
                    {getOrderEarning(order).toFixed(2)}
                    (Tip)
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderManagement;