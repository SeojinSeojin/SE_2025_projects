import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import LocationPickerMap from "../../components/LocationPickerMap";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";
import CustomerBadges from './CustomerBadges';
import './CustomerHome.css';


interface StructuredAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

const CustomerHome: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  // 暫存地址（structured + full）
  interface TempAddress {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    fullAddress?: string;
  }
  const [tempAddress, setTempAddress] = useState<TempAddress | null>(null);

  // 暫存座標
  const [tempLocation, setTempLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // ✅ 永遠存在的 userId（就算 user 還沒載到，也只是空字串）
  const userId = user?.id ?? "";

  // ✅ Hooks 一律放在最上面，不能被 if 包住
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants-by-distance", userId],
    enabled: !!userId, // 沒 userId 就不打 API，但 hook 仍然被呼叫
    queryFn: async () => {
      const res = await api.get(
        `/customer/restaurants-by-distance?userId=${userId}`
      );
      return res.data.restaurants;
    },
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["recentOrders", userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await api.get("/orders/customer");
      return res.data.orders.slice(0, 3);
    },
  });

  const handleLocationSelected = useCallback(
    (
      lat: number,
      lng: number,
      fullAddress: string,
      structured: StructuredAddress
    ) => {
      setTempLocation({ lat, lng });
      setTempAddress({
        ...structured,
        fullAddress,
      });
    },
    []
  );

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const googleMaps = (window as unknown as { google?: typeof google })
            .google;
          if (!googleMaps || !googleMaps.maps) {
            console.error("Google Maps JS SDK not loaded");
            return;
          }

          const geocoder = new googleMaps.maps.Geocoder();

          geocoder.geocode(
            { location: { lat: latitude, lng: longitude } },
            async (results:any, status:any) => {
              if (status !== "OK" || !results || !results[0]) {
                alert("Unable to get address from your location.");
                return;
              }

              const r = results[0];

              // 解析 address_components
              const structured: {
                street: string;
                city: string;
                state: string;
                zipCode: string;
              } = (() => {
                let streetNumber = "";
                let route = "";
                let city = "";
                let state = "";
                let zip = "";

                r.address_components.forEach((comp:any) => {
                  if (comp.types.includes("street_number"))
                    streetNumber = comp.long_name;
                  if (comp.types.includes("route")) route = comp.long_name;
                  if (
                    comp.types.includes("locality") ||
                    comp.types.includes("sublocality") ||
                    comp.types.includes("postal_town")
                  ) {
                    if (!city) city = comp.long_name;
                  }
                  if (comp.types.includes("administrative_area_level_1"))
                    state = comp.short_name;
                  if (comp.types.includes("postal_code")) zip = comp.long_name;
                });

                return {
                  street: `${streetNumber} ${route}`.trim(),
                  city,
                  state,
                  zipCode: zip,
                };
              })();

              const fullAddress = r.formatted_address;

              // 更新 firebase user
              setSaving(true);
              try {
                await api.put(`/users/${user?.id}`, {
                  profile: {
                    ...user?.profile,
                    address: {
                      ...structured,
                      fullAddress,
                    },
                  },
                  location: { lat: latitude, lng: longitude },
                });

                await refreshUser();
              } finally {
                setSaving(false);
              }
            }
          );
        } catch (err) {
          console.error("GPS failed:", err);
        }
      },
      () => {
        alert("Unable to retrieve your location.");
      }
    );
  }, [user, refreshUser]);

  const handleGeocodeManualInput = async () => {
    if (!tempAddress?.street) {
      alert("Please enter an address.");
      return;
    }

    const addressString = `${tempAddress.street}, ${tempAddress.city}, ${tempAddress.state} ${tempAddress.zipCode}`;

    const g = (window as unknown as { google?: typeof google }).google;
    if (!g || !g.maps) return;

    const gc = new g.maps.Geocoder();

    gc.geocode({ address: addressString }, (results:any, status:any) => {
      if (status !== "OK" || !results || !results[0]) {
        alert("Unable to find that address.");
        return;
      }

      const r = results[0];
      const loc = r.geometry.location;

      setTempLocation({ lat: loc.lat(), lng: loc.lng() });
      setTempAddress({
        street: tempAddress.street,
        city: tempAddress.city,
        state: tempAddress.state,
        zipCode: tempAddress.zipCode,
        fullAddress: r.formatted_address,
      });
    });
  };

  const handleConfirmAddress = async () => {
    if (!tempAddress || !tempLocation) {
      alert("No address selected.");
      return;
    }

    setSaving(true);

    try {
      await api.put(`/users/${user?.id}`, {
        profile: {
          ...user?.profile,
          address: tempAddress,
        },
        location: tempLocation,
      });

      await refreshUser();

      // 清空暫存
      setTempAddress(null);
      setTempLocation(null);
    } finally {
      setSaving(false);
    }
  };

  // ✅ 所有 hooks 宣告完「之後」才可以做 early return
  if (!user) {
    return <div className="customer-home">Loading user...</div>;
  }

  return (
    <div className="customer-home">
      <CustomerBadges />
      <div className="quick-actions">
        <Link to="/customer/restaurants" className="action-card">
          <div className="action-icon">🍽️</div>
          <h3>Browse Restaurants</h3>
          <p>Discover amazing local restaurants</p>
        </Link>
        
        <Link to="/customer/cart" className="action-card">
          <div className="action-icon">🛒</div>
          <h3>View Cart</h3>
          <p>Check your current order</p>
        </Link>
        
        <Link to="/customer/orders" className="action-card">
          <div className="action-icon">📦</div>
          <h3>Order History</h3>
          <p>Track your past orders</p>
        </Link>
      </div>
      
      <div className="manual-address-inputs form-group">
        <input
          type="text"
          placeholder="Street"
          value={tempAddress?.street || ""}
          onChange={(e) =>
            setTempAddress((prev) => ({
              ...(prev || {
                city: "",
                state: "",
                zipCode: "",
                fullAddress: "",
              }),
              street: e.target.value,
            }))
          }
        />

        <input
          type="text"
          placeholder="City"
          value={tempAddress?.city || ""}
          onChange={(e) =>
            setTempAddress((prev) => ({
              ...(prev || {
                street: "",
                state: "",
                zipCode: "",
                fullAddress: "",
              }),
              city: e.target.value,
            }))
          }
        />

        <input
          type="text"
          placeholder="State"
          value={tempAddress?.state || ""}
          onChange={(e) =>
            setTempAddress((prev) => ({
              ...(prev || {}),
              state: e.target.value,
            }))
          }
        />

        <input
          type="text"
          placeholder="ZIP Code"
          value={tempAddress?.zipCode || ""}
          onChange={(e) =>
            setTempAddress((prev) => ({
              ...(prev || {}),
              zipCode: e.target.value,
            }))
          }
        />

        <button
          className="btn btn-secondary"
          onClick={handleGeocodeManualInput}
        >
          Lookup Address
        </button>
      </div>

      {/* 地址區塊 + 開啟地圖按鈕 */}
      <section className="user-location-section">
        <span>
          📍 Current address:{" "}
          {user.profile?.address?.fullAddress ||
            "No address set. Click the button to set one."}
        </span>
        <div className="user-location-header">
          <button className="btn btn-secondary" onClick={handleUseMyLocation}>
              Use My Location
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowLocationPicker((prev) => !prev)}
          >
            {showLocationPicker
              ? "Close map"
              : user.profile?.address?.fullAddress
              ? "Change address"
              : "Set address"}
          </button>
        </div>

        {showLocationPicker && (
          <div className="user-location-map-wrapper">
            <LocationPickerMap
              defaultLat={user.location?.latitude}
              defaultLng={user.location?.longitude}
              defaultAddress={user.profile?.address?.fullAddress}
              onLocationSelected={handleLocationSelected}
            />
            {saving && <p>Saving your location...</p>}
          </div>
        )}
      </section>
      {(tempAddress || tempLocation) && (
        <div className="address-confirm-actions">
          <button className="btn btn-primary" onClick={handleConfirmAddress}>
            Confirm
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => {
              setTempAddress(null);
              setTempLocation(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Nearby Restaurants：依距離排序（由後端處理） */}
      <div className="featured-restaurants">
        <h2>Featured Restaurants</h2>
        <div className="restaurants-grid">
          {restaurants?.map((restaurant: any) => (
            <div key={restaurant.id} className="restaurant-card">
              <div className="restaurant-header">
                <h3>{restaurant.name}</h3>
                {restaurant.isLocalLegend && (
                  <span className="local-legend-badge">🏆 Local Legend</span>
                )}
              </div>
              <p className="restaurant-cuisine">{restaurant.cuisine}</p>
              <div className="restaurant-rating">
                <span className="rating">⭐ {restaurant.rating}</span>
                <span className="delivery-time">
                  {restaurant.distanceMiles
                    ? `${restaurant.distanceMiles} miles away`
                    : restaurant.deliveryTime}
                </span>
              </div>
              <Link
                to={`/customer/restaurants?restaurant=${restaurant.id}`}
                className="btn btn-primary"
              >
                View Menu
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* 最近訂單區塊 */}
      {recentOrders && recentOrders.length > 0 && (
        <div className="recent-orders">
          <h2>Recent Orders</h2>
          <div className="orders-list">
            {recentOrders.map((order: any) => (
              <div key={order.id} className="order-card">
                <div className="order-info">
                  <h4>Order #{order.id.slice(-6)}</h4>
                  <p>Total: ${order.totalAmount}</p>
                  <span className={`status status-${order.status}`}>
                    {order.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <div className="order-actions">
                  <Link
                    to={`/customer/orders/${order.id}`}
                    className="btn btn-secondary"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerHome;
