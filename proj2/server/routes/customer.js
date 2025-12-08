const express = require("express");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const Restaurant = require("../models/Restaurant");

const router = express.Router();

// Get customer profile by email and password
router.post(
  "/profile",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 1 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      const user = await User.findByEmail(email);

      if (!user || user.password !== password || user.role !== "customer") {
        return res
          .status(401)
          .json({ error: "Invalid credentials or not a customer" });
      }

      res.json({ customer: user.toJSON() });
    } catch (error) {
      console.error("Get customer profile error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Update customer profile by email and password
router.put(
  "/profile",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 1 }),
    body("profile.name").optional().isString(),
    body("profile.phone").optional().isString(),
    body("profile.address").optional().isObject(),
    body("profile.preferences").optional().isObject(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, profile } = req.body;
      const user = await User.findByEmail(email);

      if (!user || user.password !== password || user.role !== "customer") {
        return res
          .status(401)
          .json({ error: "Invalid credentials or not a customer" });
      }

      const updatedUser = await user.update({ profile });

      res.json({
        message: "Profile updated successfully",
        customer: updatedUser.toJSON(),
      });
    } catch (error) {
      console.error("Update customer profile error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Get all restaurants
router.get("/restaurants", async (req, res) => {
  try {
    console.log("Fetching restaurants from users collection...");

    // Get all users with role 'restaurant'
    const { db } = require("../config/firebase");
    const usersSnapshot = await db
      .collection("users")
      .where("role", "==", "restaurant")
      .get();

    const restaurants = [];

    // Process each restaurant
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      if (userData.profile && userData.profile.name) {
        // Calculate average rating from customer ratings
        let averageRating = 0;
        try {
          const ordersSnapshot = await db
            .collection("orders")
            .where("restaurantId", "==", doc.id)
            .where("status", "==", "delivered")
            .get();

          let totalRating = 0;
          let ratingCount = 0;

          ordersSnapshot.forEach((orderDoc) => {
            const orderData = orderDoc.data();
            if (
              orderData.ratings &&
              orderData.ratings.customer &&
              orderData.ratings.customer.rating
            ) {
              totalRating += orderData.ratings.customer.rating;
              ratingCount++;
            }
          });

          if (ratingCount > 0) {
            averageRating = Math.round((totalRating / ratingCount) * 10) / 10; // Round to 1 decimal place
          }
        } catch (ratingError) {
          console.error(
            "Error calculating rating for restaurant",
            doc.id,
            ratingError
          );
        }

        // Convert user data to restaurant format
        const restaurant = {
          id: doc.id,
          name: userData.profile.name,
          cuisine: userData.profile.cuisine || "Unknown",
          description: userData.profile.description || "",
          rating: averageRating || userData.profile.rating || 0,
          deliveryTime: userData.profile.deliveryTime || "30-45 min",
          isLocalLegend: userData.profile.isLocalLegend || false,
          menu: userData.profile.menu || [],
          address: userData.profile.address || {},
          phone: userData.profile.phone || "",
          email: userData.email,
          isActive: true,
          ownerId: doc.id,
          location: userData.profile.location || null,
        };
        restaurants.push(restaurant);
      }
    }

    console.log("Found restaurants:", restaurants.length);
    res.json({ restaurants });
    console.log(restaurants[1].location);
  } catch (error) {
    console.error("Get restaurants error:", error.message);
    res.status(500).json({
      error: "Failed to fetch restaurants.",
      details: error.message,
    });
  }
});

// ⭐⭐⭐ Get restaurants sorted by distance ⭐⭐⭐
router.get("/restaurants-by-distance", async (req, res) => {
  try {
    const { db } = require("../config/firebase");

    // 1. 取得 User ID（你前端有 token 就會在 req.user / 自行注入）
    // 你沒有 auth middleware，所以前端直接傳 userId
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    // for debug
    console.log("🔥 [DEBUG] restaurants-by-distance route hit");

    // 2. 讀取使用者位置
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    if (!userData.location) {
      return res.status(400).json({ error: "User has no saved location" });
    }

    const userLat = userData.location.latitude;
    const userLng = userData.location.longitude;

    // 3. 取得所有餐廳
    const restaurantsSnapshot = await db
      .collection("users")
      .where("role", "==", "restaurant")
      .get();

    // for debug
    console.log("🔥 [DEBUG] userId from query:", userId);
    console.log("🔥 [DEBUG] userDoc exists?", userDoc.exists);
    console.log("🔥 [DEBUG] userData.location:", userData.location);
    console.log("🔥 [DEBUG] total restaurant docs:", restaurantsSnapshot.size);

    const restaurants = [];

    // 4. 定義 Haversine function
    function haversineDistance(lat1, lon1, lat2, lon2) {
      const R = 6371; // km
      const toRad = (v) => (v * Math.PI) / 180;

      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // 5. 計算每家餐廳距離 + rating
    for (const doc of restaurantsSnapshot.docs) {
      const data = doc.data();

      if (!data.location) continue; // 沒地址的餐廳跳過

      const restLat = data.location.latitude;
      const restLng = data.location.longitude;

      const distanceKm = haversineDistance(userLat, userLng, restLat, restLng);
      const distanceMiles = distanceKm * 0.621371;

      // 計算平均 rating（從 orders 裡面的 customer rating）
      let averageRating = null;
      try {
        const ordersSnapshot = await db
          .collection("orders")
          .where("restaurantId", "==", doc.id)
          .where("status", "==", "delivered")
          .get();

        let totalRating = 0;
        let ratingCount = 0;

        ordersSnapshot.forEach((orderDoc) => {
          const orderData = orderDoc.data();
          if (
            orderData.ratings &&
            orderData.ratings.customer &&
            typeof orderData.ratings.customer.rating === "number"
          ) {
            totalRating += orderData.ratings.customer.rating;
            ratingCount++;
          }
        });

        if (ratingCount > 0) {
          averageRating = Math.round((totalRating / ratingCount) * 10) / 10; // 1 decimal place
        }
      } catch (ratingError) {
        console.error("Error calculating rating for restaurant", doc.id, ratingError);
        averageRating = null;
      }

      // fallback to profile.rating if no orders-based rating found
      const finalRating =
        averageRating !== null
          ? averageRating
          : typeof data.profile?.rating === "number"
          ? data.profile.rating
          : 0;

      // for debug
      console.log("🔥 [DEBUG] restaurant raw data:", data);
      console.log("🔥 [DEBUG] computed distance (Miles):", distanceMiles);
      console.log("🔥 [DEBUG] computed rating:", finalRating);

      restaurants.push({
        id: doc.id,
        name: data.profile?.name,
        cuisine: data.profile?.cuisine,
        description: data.profile?.description,
        rating: finalRating,
        address: data.profile?.address,
        location: data.location,
        distanceKm: Number(distanceKm.toFixed(2)),
        distanceMiles: Number(distanceMiles.toFixed(2)),
      });
      console.log("🔥 [DEBUG] pushed restaurant:", data.profile?.name);
    }

    // 6. 按距離排序
    restaurants.sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({ restaurants });
  } catch (error) {
    console.error("Distance sort error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
