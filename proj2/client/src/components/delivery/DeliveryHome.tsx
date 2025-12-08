import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import './DeliveryHome.css';

const DeliveryHome: React.FC = () => {
  const { user } = useAuth();

  const { data: assignedOrders = [] } = useQuery({
    queryKey: ['deliveryOrders', user?.id],
    queryFn: async () => {
      const response = await api.get(`/delivery/orders?riderId=${user?.id}`);
      return response.data.orders;
    },
    enabled: !!user,
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchOnWindowFocus: true
  });

  // Get current user status
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser', user?.id],
    queryFn: async () => {
      const response = await api.post('/delivery/profile', {
        email: user?.email,
        password: 'dummy' // This is just to get the current user data
      });
      return response.data.user;
    },
    enabled: !!user,
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchOnWindowFocus: true
  });

  const { data: availableOrders = [] } = useQuery({
    queryKey: ['availableOrders'],
    queryFn: async () => {
      console.log('Fetching available orders from client...');
      const response = await api.get('/delivery/available');
      console.log('Available orders response:', response.data);
      return response.data.orders;
    },
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchOnWindowFocus: true
  });

  const activeOrders = assignedOrders.filter((order: any) => 
    ['out_for_delivery'].includes(order.status)
  );

  const pendingOrders = assignedOrders.filter((order: any) => 
    ['ready'].includes(order.status)
  );

  const completedOrders = assignedOrders.filter((order: any) => 
    ['delivered'].includes(order.status)
  );

  const totalEarnings = completedOrders.reduce((total: number, order: any) => {
    const deliveryFee = typeof order.deliveryFee === 'number' ? order.deliveryFee : 0;
    const tipAmount = typeof order.tipAmount === 'number' ? order.tipAmount : 0;
    const earning = typeof order.earning === 'number' ? order.earning : deliveryFee + tipAmount;
    return total + earning;
  }, 0);

  // Check if rider has any active orders (ready or out_for_delivery)
  const hasActiveOrders = assignedOrders.some((order: any) => 
    ['ready', 'out_for_delivery'].includes(order.status)
  );

  return (
    <div className="delivery-home">
      <div className="welcome-section">
        <h2>Welcome, {user?.profile?.name || 'Delivery Partner'}! 🚚</h2>
        <p>Manage your delivery assignments and track your orders.</p>
      </div>

      <div className="orders-overview">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-number">{assignedOrders.length}</div>
            <div className="stat-label">Assigned Orders</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <div className="stat-number">{pendingOrders.length}</div>
            <div className="stat-label">Pending Pickup</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🚚</div>
          <div className="stat-content">
            <div className="stat-number">{activeOrders.length}</div>
            <div className="stat-label">Out for Delivery</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-number">${totalEarnings.toFixed(2)}</div>
            <div className="stat-label">Total Earnings</div>
          </div>
        </div>
      </div>

      {/* Available Orders Section - PRIORITY */}
      {availableOrders.length > 0 && (
        <div className="available-orders">
          <h3>🚨 Available Orders ({availableOrders.length})</h3>
          <p>These orders are ready for pickup. <strong>First come, first serve!</strong> Click "Accept" to claim them.</p>
          {hasActiveOrders && (
            <div className="restriction-notice">
              <p><strong>⚠️ You have an active order. Complete it before accepting another.</strong></p>
            </div>
          )}
          <div className="orders-list">
            {availableOrders.map((order: any) => (
              <div key={order.id} className="order-card available">
                <div className="order-header">
                  <h4>Order #{order.id.slice(-6)}</h4>
                  <span className="status status-ready">READY</span>
                </div>
                <div className="order-details">
                  <p><strong>Total:</strong> ${order.totalAmount.toFixed(2)}</p>
                  <p><strong>Items:</strong> {order.items.length} item(s)</p>
                  <p><strong>Restaurant:</strong> {order.restaurantId}</p>
                  <p><strong>Ready since:</strong> {new Date(order.updatedAt).toLocaleString()}</p>
                </div>
                <div className="order-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      // Navigate to order management to accept this order
                      window.location.href = '/delivery/orders';
                    }}
                  >
                    See Order
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {assignedOrders.length === 0 && availableOrders.length === 0 && (
        <div className="no-orders">
          <div className="no-orders-icon">📦</div>
          <h3>No orders available</h3>
          <p>Orders will appear here when restaurants mark them as ready for pickup.</p>
        </div>
      )}

      {assignedOrders.length > 0 && (
        <div className="assigned-orders">
          <h3>Your Assigned Orders</h3>
          <div className="orders-list">
            {assignedOrders.map((order: any) => (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <h4>Order #{order.id.slice(-6)}</h4>
                  <span className={`status status-${order.status}`}>
                    {order.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="order-details">
                  <p><strong>Total:</strong> ${order.totalAmount.toFixed(2)}</p>
                  <p><strong>Items:</strong> {order.items.length} item(s)</p>
                  <p><strong>Assigned:</strong> {new Date(order.assignedAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryHome;