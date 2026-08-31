const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
  end: jest.fn(),
});

const findRoute = (router, path, method) => {
  const layer = router.stack.find(
    (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
  );

  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} was not found`);
  }

  return layer.route.stack;
};

const invokeRoute = async (router, path, method, req, res) => {
  const handlers = findRoute(router, path, method);
  let index = 0;

  const next = async () => {
    index += 1;
    if (index < handlers.length) {
      return handlers[index].handle(req, res, next);
    }
    return undefined;
  };

  for (const handler of handlers) {
    await handler.handle(req, res, next);
    if (res.status.mock.calls.length || res.json.mock.calls.length || res.send.mock.calls.length) {
      return;
    }
  }
};

describe('UC2 — Log in', () => {
  it('allows a registered customer to log in with valid credentials', async () => {
    jest.resetModules();
    jest.doMock('../proj2/server/models/User', () => ({
      findByEmail: jest.fn().mockResolvedValue({
        password: 'secret123',
        toJSON: () => ({ id: 'cust-1', email: 'customer@example.com', role: 'customer' }),
      }),
    }));

    const authRouter = require('../proj2/server/routes/auth');
    const req = { body: { email: 'customer@example.com', password: 'secret123' } };
    const res = mockRes();

    await invokeRoute(authRouter, '/login', 'post', req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Login successful',
        user: expect.objectContaining({ email: 'customer@example.com' }),
      })
    );
  });
});

describe('UC6 — Place an order', () => {
  it('blocks a negative total before creating an order', async () => {
    jest.resetModules();
    const orderSet = jest.fn().mockResolvedValue();
    jest.doMock('../proj2/server/config/firebase', () => ({
      db: {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({ set: orderSet })),
        })),
      },
    }));

    const orderRouter = require('../proj2/server/routes/orders');
    const req = {
      body: {
        restaurantId: 'rest-101',
        customerId: 'cust-1',
        deliveryAddress: { street: '10 Main St', city: 'Raleigh', state: 'NC', zipCode: '27601' },
        items: [{ menuItemId: 'm1', quantity: 1, price: 12.5 }],
        totalAmount: -5,
      },
    };
    const res = mockRes();

    await invokeRoute(orderRouter, '/', 'post', req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(orderSet).not.toHaveBeenCalled();
  });
});

describe('UC9 — Earn and view points', () => {
  it('awards points for a completed order in the customer points ledger', async () => {
    jest.resetModules();
    const pointsSet = jest.fn().mockResolvedValue();
    const fakePointsDoc = { exists: false };
    jest.doMock('../proj2/server/config/firebase', () => ({
      db: {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue(fakePointsDoc),
            set: pointsSet,
          })),
        })),
      },
    }));

    const { awardPointsForOrder } = require('../proj2/server/routes/points');
    await awardPointsForOrder('cust-1', 42.75);

    expect(pointsSet).toHaveBeenCalledWith(
      expect.objectContaining({
        totalPoints: 42,
        availablePoints: 42,
        transactions: expect.arrayContaining([
          expect.objectContaining({ type: 'earned', amount: 42 }),
        ]),
      })
    );
  });
});

describe('UC12 — Handle an incoming order', () => {
  it('requires a valid kitchen workflow before an order can be marked delivered', async () => {
    jest.resetModules();
    const orderUpdate = jest.fn().mockResolvedValue();
    jest.doMock('../proj2/server/config/firebase', () => ({
      db: {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            update: orderUpdate,
          })),
        })),
      },
    }));

    const orderRouter = require('../proj2/server/routes/orders');
    const req = {
      params: { id: 'order-42' },
      body: { status: 'delivered' },
    };
    const res = mockRes();

    await invokeRoute(orderRouter, '/:id/status', 'put', req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(orderUpdate).not.toHaveBeenCalled();
  });
});

describe('UC19 — Earn and view badges', () => {
  it('returns earned badge data for a customer with stored stats', async () => {
    jest.resetModules();
    const fakeUserDoc = {
      exists: true,
      data: () => ({
        badges: { total_orders: { currentTier: 'bronze' } },
        badgesStats: { totalOrdersCount: 5, lifetimeSpend: 200 },
        badgesLastComputedAt: '2026-08-30T00:00:00.000Z',
      }),
    };

    jest.doMock('../proj2/server/config/firebase', () => ({
      db: {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue(fakeUserDoc),
          })),
        })),
      },
    }));

    jest.doMock('../proj2/server/services/buildCustomerStats', () => ({
      buildCustomerStats: jest.fn().mockResolvedValue({ totalOrdersCount: 5, lifetimeSpend: 200 }),
    }));

    jest.doMock('../proj2/src/badges/badgeDefinitions', () => ({
      badgeDefinitions: [{ id: 'total_orders', metric: 'totalOrdersCount', tiers: [{ tier: 'bronze', threshold: 5 }] }],
    }));

    jest.doMock('../proj2/src/badges/evaluateBadges', () => ({
      evaluateBadges: jest.fn().mockReturnValue([
        { id: 'total_orders', currentTier: 'bronze', value: 5 },
      ]),
    }));

    const { getCustomerBadges } = require('../proj2/server/services/badgeService');
    const result = await getCustomerBadges('cust-1');

    expect(result.evaluatedBadges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'total_orders', currentTier: 'bronze' }),
      ])
    );
    expect(result.stats).toEqual(expect.objectContaining({ totalOrdersCount: 5 }));
  });
});
