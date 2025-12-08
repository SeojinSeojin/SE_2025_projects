import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import './OrderManagement.css';

interface Order {
  id: string;
  customerId: string;
  restaurantId: string;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  totalAmount: number;
  deliveryAddress: any;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  ratings?: {
    customer?: {
      rating: number;
      review?: string;
      ratedAt?: Date;
    };
  };
  tipAmount?: number;
}

const OrderManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get orders for this restaurant
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['restaurantOrders', user?.id],
    queryFn: async () => {
      const response = await api.get(`/orders/restaurant?restaurantId=${user?.id}`);
      return response.data.orders;
    },
    enabled: !!user
  });

  // Update order status mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const response = await api.put(`/orders/${orderId}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurantOrders'] });
    }
  });

  const handleAcceptOrder = (orderId: string) => {
    updateOrderStatusMutation.mutate({ orderId, status: 'confirmed' });
  };

  const handleRejectOrder = (orderId: string) => {
    updateOrderStatusMutation.mutate({ orderId, status: 'cancelled' });
  };

  const handleUpdateStatus = (orderId: string, status: string) => {
    updateOrderStatusMutation.mutate({ orderId, status });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#ff9800';
      case 'confirmed': return '#2196f3';
      case 'preparing': return '#9c27b0';
      case 'ready': return '#4caf50';
      case 'out_for_delivery': return '#00bcd4';
      case 'delivered': return '#8bc34a';
      case 'cancelled': return '#f44336';
      default: return '#757575';
    }
  };

  const pendingOrders = orders.filter(order => order.status === 'pending');
  const activeOrders = orders.filter(order => 
    ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status)
  );
  const completedOrders = orders.filter(order => 
    ['delivered', 'cancelled'].includes(order.status)
  );

  return (
    <div className="order-management">
      <h1>Order Management</h1>
      <p>Manage incoming orders, accept/reject orders, and track order status.</p>

      {/* Pending Orders */}
      <div className="orders-section">
        <h2>Pending Orders ({pendingOrders.length})</h2>
        {pendingOrders.length === 0 ? (
          <p className="no-orders">No pending orders</p>
        ) : (
          <div className="orders-list">
            {pendingOrders.map((order) => (
              <div key={order.id} className="order-card pending">
                <div className="order-header">
                  <h3>Order #{order.id.slice(-6)}</h3>
                  <span className="order-time">
                    {new Date(order.createdAt).toLocaleString()}
                  </span>
                </div>
                
                <div className="order-items">
                  <h4>Items:</h4>
                  <ul>
                    {order.items.map((item, index) => (
                      <li key={index}>
                        {item.quantity}x {item.name} - ${item.price.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="order-total">
                  <strong>Total: ${order.totalAmount.toFixed(2)}</strong>
                </div>

                <div className="order-actions">
                  <button 
                    className="btn btn-success"
                    onClick={() => handleAcceptOrder(order.id)}
                    disabled={updateOrderStatusMutation.isPending}
                  >
                    Accept
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={() => handleRejectOrder(order.id)}
                    disabled={updateOrderStatusMutation.isPending}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Orders */}
      <div className="orders-section">
        <h2>Active Orders ({activeOrders.length})</h2>
        {activeOrders.length === 0 ? (
          <p className="no-orders">No active orders</p>
        ) : (
          <div className="orders-list">
            {activeOrders.map((order) => (
              <div key={order.id} className="order-card active">
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
                  <h4>Items:</h4>
                  <ul>
                    {order.items.map((item, index) => (
                      <li key={index}>
                        {item.quantity}x {item.name} - ${item.price.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="order-total">
                  <strong>Total: ${order.totalAmount.toFixed(2)}</strong>
                  {order.tipAmount && <div>(+Tip: ${order.tipAmount?.toFixed(2)})</div>}
                </div>

                <div className="order-actions">
                  {order.status === 'confirmed' && (
                    <button 
                      className="btn btn-primary"
                      onClick={() => handleUpdateStatus(order.id, 'preparing')}
                      disabled={updateOrderStatusMutation.isPending}
                    >
                      Start Preparing
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button 
                      className="btn btn-success"
                      onClick={() => handleUpdateStatus(order.id, 'ready')}
                      disabled={updateOrderStatusMutation.isPending}
                    >
                      Mark Ready
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Orders */}
      <div className="orders-section">
        <h2>Order History ({completedOrders.length})</h2>
        {completedOrders.length === 0 ? (
          <p className="no-orders">No completed orders</p>
        ) : (
          <div className="orders-list">
            {completedOrders.map((order) => (
              <div
                key={order.id}
                className={`order-card ${order.status === 'cancelled' ? 'cancelled' : 'completed'}`}
              >
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
                  <h4>Items:</h4>
                  <ul>
                    {order.items.map((item, index) => (
                      <li key={index}>
                        {item.quantity}x {item.name} - ${item.price.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="order-total">
                  <strong>Total: ${order.totalAmount.toFixed(2)}</strong>
                </div>

                <div className="order-time">
                  <p><strong>Completed:</strong> {new Date(order.updatedAt).toLocaleString()}</p>
                </div>

                {order.ratings?.customer && (
                  <div className="order-rating">
                    <h4>Customer Rating:</h4>
                    <div className="rating-display">
                      <span className="rating-stars">
                        {'★'.repeat(order.ratings.customer.rating)}{'☆'.repeat(5 - order.ratings.customer.rating)}
                      </span>
                      <span className="rating-text">{order.ratings.customer.rating}/5</span>
                    </div>
                    {order.ratings.customer.review && (
                      <div className="rating-review">
                        <p><em>"{order.ratings.customer.review}"</em></p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderManagement;
