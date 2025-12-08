import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { api } from '../../services/api';
import './Cart.css';

const Cart: React.FC = () => {
  const { items, updateQuantity, removeItem, clearCart, getTotalPrice, getTotalItems } = useCart();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [tipAmount, setTipAmount] = useState(0);

  const { data: points } = useQuery({
    queryKey: ['customerPoints', user?.id],
    queryFn: async () => {
      const response = await api.get(`/points?customerId=${user?.id}`);
      return response.data.points;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true
  });

  const { data: discountInfo } = useQuery({
    queryKey: ['discountInfo', pointsToUse, user?.id],
    queryFn: async () => {
      if (pointsToUse <= 0 || !user?.id) return { discountAmount: 0, maxDiscount: 0 };
      const response = await api.post('/points/calculate-discount', {
        points: pointsToUse,
        customerId: user.id
      });
      return response.data;
    },
    enabled: usePoints && pointsToUse > 0 && !!user?.id
  });

  const usePointsMutation = useMutation({
    mutationFn: async (pointsToUse: number) => {
      const response = await api.post('/points/use', {
        points: pointsToUse,
        description: 'Points redeemed for order discount',
        customerId: user?.id
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerPoints'] });
    },
    onError: (error: any) => {
      alert('Failed to use points: ' + (error.response?.data?.error || 'Unknown error'));
    }
  });

  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await api.post('/orders', orderData);
      return response.data;
    },
    onSuccess: () => {
      clearCart();
      alert('Order placed successfully! You will earn points when it\'s delivered.');
    },
    onError: (error: any) => {
      alert('Failed to place order: ' + (error.response?.data?.error || 'Unknown error'));
    }
  });

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      alert('Your cart is empty!');
      return;
    }

    if (!user) {
      alert('Please log in to place an order');
      return;
    }

    try {
      // Use points first if selected
      if (usePoints && pointsToUse > 0) {
        await usePointsMutation.mutateAsync(pointsToUse);
      }

      // Group items by restaurant
      const restaurantGroups = items.reduce((groups: any, item) => {
        if (!groups[item.restaurantId]) {
          groups[item.restaurantId] = {
            restaurantId: item.restaurantId,
            restaurantName: item.restaurantName,
            items: []
          };
        }
        groups[item.restaurantId].items.push({
          menuItemId: item.id,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
        });
        return groups;
      }, {});

      // For now, place one order per restaurant
      Object.values(restaurantGroups).forEach((group: any) => {
        const totalAmount = group.items.reduce((sum: number, item: any) =>
          sum + (item.price * item.quantity), 0
        );

        // The total amount calculated here is the subtotal (items only)

        const finalAmount = usePoints && discountInfo ?
          Math.max(0, totalAmount - discountInfo.discountAmount) : totalAmount;

        // NOTE: The backend 'totalAmount' field should ideally store the final amount including the tip.
        // Based on your backend, 'totalAmount' seems to be the order subtotal (before tip/discount).
        // Let's ensure the backend saves the tip separately.

        placeOrderMutation.mutate({
          restaurantId: group.restaurantId,
          customerId: user.id,
          items: group.items,
          totalAmount: finalAmount, // Subtotal minus discount
          tipAmount: tipAmount, // <--- ADD THE TIP AMOUNT
          deliveryAddress: user.profile?.address || {
            street: '123 Main St',
            city: 'City',
            state: 'State',
            zipCode: '12345'
          }
        });
      });
    } catch (error) {
      console.error('Error placing order:', error);
    }
  };

  if (items.length === 0) {
    return (
      <div className="empty-cart">
        <div className="empty-cart-icon">🛒</div>
        <h2>Your cart is empty</h2>
        <p>Add some delicious items from our restaurants!</p>
      </div>
    );
  }

  const totalPrice = getTotalPrice();
  const discountAmount = usePoints && discountInfo ? discountInfo.discountAmount : 0;
  const finalPrice = Math.max(0, totalPrice - discountAmount);

  return (
    <div className="cart">
      <h1>Shopping Cart</h1>

      <div className="cart-items">
        {items.map((item) => (
          <div key={item.id} className="cart-item">
            <div className="item-info">
              <h4>{item.name}</h4>
              <p>{item.restaurantName}</p>
              <span className="item-price">${item.price}</span>
            </div>
            <div className="item-controls">
              <div className="quantity-controls">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="quantity-btn"
                >
                  -
                </button>
                <span className="quantity">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="quantity-btn"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => removeItem(item.id)}
                className="remove-btn"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {points && points.availablePoints > 0 && (
        <div className="points-section">
          <h3>Use Points for Discount</h3>
          <div className="points-controls">
            <label>
              <input
                type="checkbox"
                checked={usePoints}
                onChange={(e) => setUsePoints(e.target.checked)}
              />
              Use points (Available: {points.availablePoints})
            </label>
            {usePoints && (
              <div className="points-input">
                <input
                  type="number"
                  min="0"
                  max={points.availablePoints}
                  value={pointsToUse}
                  onChange={(e) => setPointsToUse(parseInt(e.target.value) || 0)}
                  placeholder="Points to use"
                />
                {discountInfo && (
                  <span className="discount-info">
                    Discount: ${discountInfo.discountAmount.toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tip Input Section */}
      <div className="tip-section">
        <h3>Add Tip for Delivery Partner</h3>
        <div className="tip-input-controls form-group">
          <label htmlFor="tip-amount">Tip Amount ($):</label>
          <input
            id="tip-amount"
            type="number"
            min="0"
            step="0.01"
            value={tipAmount.toFixed(2)}
            onChange={(e) => setTipAmount(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="cart-summary">
        <div className="summary-row">
          <span>Subtotal:</span>
          <span>${totalPrice.toFixed(2)}</span>
        </div>
        {usePoints && discountAmount > 0 && (
          <div className="summary-row discount">
            <span>Discount:</span>
            <span>-${discountAmount.toFixed(2)}</span>
          </div>
        )}

        {/* ADD TIP AMOUNT TO SUMMARY */}
        <div className="summary-row tip">
          <span>Tip:</span>
          <span>+${tipAmount.toFixed(2)}</span>
        </div>
        {/* UPDATE TOTAL CALCULATION and DISPLAY */}
        {/* Update local calculation: Final price now includes tip */}
        <div className="summary-row total">
          <span>Total Payable:</span>
          <span>${(finalPrice + tipAmount).toFixed(2)}</span>
        </div>

        <div className="summary-row">
          <span>Items:</span>
          <span>{getTotalItems()}</span>
        </div>
      </div>

      <div className="cart-actions">
        <button
          onClick={clearCart}
          className="btn btn-secondary"
        >
          Clear Cart
        </button>
        <button
          onClick={handlePlaceOrder}
          className="btn btn-primary"
          disabled={placeOrderMutation.isPending}
        >
          {placeOrderMutation.isPending ? 'Placing Order...' : 'Place Order'}
        </button>
      </div>
    </div>
  );
};

export default Cart;
