import { useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import './Insights.css';

interface Order {
    id: string;
    totalAmount: number;
    tipAmount: number;
    deliveryFee?: number;
    earning?: number;
    status: string;
    createdAt: string;
    assignedAt?: string;
    deliveredAt?: string;
    distance?: number;
}

type TimeRange = 'daily' | 'weekly' | 'monthly';

const getOrderEarning = (order: Order): number => {
    const deliveryFee = typeof order.deliveryFee === 'number' ? order.deliveryFee : 0;
    const tipAmount = typeof order.tipAmount === 'number' ? order.tipAmount : 0;
    if (typeof order.earning === 'number') {
        return order.earning;
    }
    return deliveryFee + tipAmount;
};

const Insights: React.FC = () => {
    const { user } = useAuth();
    const [earningsRange, setEarningsRange] = useState<TimeRange>('daily');

    const { data: orders = [], isLoading } = useQuery<Order[]>({
        queryKey: ['deliveryOrders', user?.id],
        queryFn: async () => {
            // Fetching all orders assigned to delivery partner
            // Ideally should filter by status=delivered backend side, but simplified here
            const response = await api.get(`/delivery/orders?riderId=${user?.id}`);
            return response.data.orders;
        },
        enabled: !!user?.id
    });

    const metrics = useMemo(() => {
        if (!orders.length) return null;

        const deliveredOrders = orders.filter(o => o.status === 'delivered');
        if (!deliveredOrders.length) return null;

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Helper to get start of week (Sunday)
        const getStartOfWeek = (d: Date) => {
            const date = new Date(d);
            const day = date.getDay() === 0 ? 7 : date.getDay();
            const diff = date.getDate() - day;
            return new Date(date.setDate(diff));
        };
        const startOfWeek = getStartOfWeek(now);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Previous periods for comparison
        const previousDayStart = new Date(startOfToday);
        previousDayStart.setDate(startOfToday.getDate() - 1);

        const previousWeekStart = new Date(startOfWeek);
        previousWeekStart.setDate(startOfWeek.getDate() - 7);

        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        // Filter Function
        const getStatsForPeriod = (start: Date, end: Date) => {
            const periodOrders = deliveredOrders.filter(o => {
                const d = new Date(o.deliveredAt || o.createdAt);
                return d >= start && d < end;
            });

            const totals = periodOrders.reduce((acc, order) => {
                const deliveryFee = typeof order.deliveryFee === 'number' ? order.deliveryFee : 0;
                const tipAmount = typeof order.tipAmount === 'number' ? order.tipAmount : 0;
                acc.deliveryFees += deliveryFee;
                acc.tips += tipAmount;
                acc.earnings += getOrderEarning(order);
                return acc;
            }, { earnings: 0, deliveryFees: 0, tips: 0 });

            return { ...totals, count: periodOrders.length };
        };

        // Current Range Stats
        let currentStats, previousStats;
        let rangeLabel = '';

        if (earningsRange === 'daily') {
            currentStats = getStatsForPeriod(startOfToday, new Date(startOfToday.getTime() + 86400000));
            previousStats = getStatsForPeriod(previousDayStart, startOfToday);
            rangeLabel = "Today";
        } else if (earningsRange === 'weekly') {
            currentStats = getStatsForPeriod(startOfWeek, new Date(startOfWeek.getTime() + 7 * 86400000));
            previousStats = getStatsForPeriod(previousWeekStart, startOfWeek);
            rangeLabel = "This Week";
        } else {
            currentStats = getStatsForPeriod(startOfMonth, new Date(now.getFullYear(), now.getMonth() + 1, 0));
            previousStats = getStatsForPeriod(previousMonthStart, startOfMonth);
            rangeLabel = "This Month";
        }

        const earningsChange = previousStats.earnings === 0
            ? (currentStats.earnings > 0 ? 100 : 0)
            : ((currentStats.earnings - previousStats.earnings) / previousStats.earnings) * 100;

        // 2. Average Delivery Time
        const deliveryTimes = deliveredOrders
            .filter(o => o.assignedAt && o.deliveredAt)
            .map(o => {
                const start = new Date(o.assignedAt!).getTime();
                const end = new Date(o.deliveredAt!).getTime();
                return (end - start) / 60000;
            });

        const avgDeliveryTime = deliveryTimes.length
            ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
            : 0;

        // 3. Average Distance - REMOVED

        // 4. Peak Earning Hours
        const hoursMap = new Map<number, { earnings: number, count: number }>();
        for (let i = 0; i < 24; i++) {
            hoursMap.set(i, { earnings: 0, count: 0 });
        }

        deliveredOrders.forEach(o => {
            const date = new Date(o.deliveredAt || o.createdAt);
            if (isNaN(date.getTime())) return;

            const hour = date.getHours();
            const curr = hoursMap.get(hour);

            if (curr) {
                curr.earnings += getOrderEarning(o);
                curr.count += 1;
            }
        });

        const peakHoursData = Array.from(hoursMap.entries()).map(([hour, data]) => ({
            hour: `${hour}:00`,
            avgEarnings: data.count ? data.earnings / data.count : 0,
            volume: data.count
        }));

        return {
            currentStats,
            earningsChange,
            rangeLabel,
            avgDeliveryTime,
            peakHoursData
        };
    }, [orders, earningsRange]);

    if (isLoading) return <div>Loading insights...</div>;
    if (!metrics) return <div>No data available yet. Start delivering to see insights!</div>;

    const getTrendClass = (value: number) => {
        if (value > 0) return 'trend-positive';
        if (value < 0) return 'trend-negative';
        return 'trend-neutral';
    };

    return (
        <div className="insights-container">
            <div className="insights-header">
                <h2>Delivery Insights</h2>
                <p>Track your earnings and efficiency</p>
            </div>

            <div className="insights-cards">
                {/* Card 1: Total Earnings */}
                <div className="insight-card">
                    <div className="card-tabs">
                        <button
                            className={`card-tab ${earningsRange === 'daily' ? 'active' : ''}`}
                            onClick={() => setEarningsRange('daily')}
                        >
                            Daily
                        </button>
                        <button
                            className={`card-tab ${earningsRange === 'weekly' ? 'active' : ''}`}
                            onClick={() => setEarningsRange('weekly')}
                        >
                            Weekly
                        </button>
                        <button
                            className={`card-tab ${earningsRange === 'monthly' ? 'active' : ''}`}
                            onClick={() => setEarningsRange('monthly')}
                        >
                            Monthly
                        </button>
                    </div>
                    <div className="card-title">Total Earnings</div>
                    <div className="card-value">${metrics.currentStats.earnings.toFixed(2)}</div>
                    <div className="card-subtext">
                        <span className={`trend-indicator ${getTrendClass(metrics.earningsChange)}`}>
                            {metrics.earningsChange > 0 ? '↑' : '↓'} {Math.abs(metrics.earningsChange).toFixed(1)}%
                        </span>
                        <span> vs previous {earningsRange.replace('ly', '')}</span>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#7f8c8d' }}>
                        <span>Delivery Fees: ${metrics.currentStats.deliveryFees.toFixed(2)}</span>
                        <span style={{ marginLeft: '12px' }}>Tips: ${metrics.currentStats.tips.toFixed(2)}</span>
                    </div>
                    <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#7f8c8d' }}>
                        {metrics.currentStats.count} orders delivered
                    </div>
                </div>
            </div>

            <div className="charts-row">
                {/* Peak Hours Chart */}
                <div className="chart-section">
                    <div className="chart-header">
                        <h3>Peak Earning Hours (Avg $/Order)</h3>
                    </div>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <BarChart data={metrics.peakHoursData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="hour" />
                                <YAxis tickFormatter={(val) => `$${val}`} />
                                <Tooltip formatter={(val: number) => [`$${val.toFixed(2)}`, 'Avg Earnings']} />
                                <Bar dataKey="avgEarnings" fill="#8884d8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Avg Delivery Time Gauge */}
                <div className="chart-section">
                    <div className="chart-header">
                        <h3>Avg Speed</h3>
                    </div>
                    <div style={{ position: 'relative', height: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[{ value: metrics.avgDeliveryTime }, { value: 60 - metrics.avgDeliveryTime }]}
                                    cx="50%"
                                    cy="70%"
                                    startAngle={180}
                                    endAngle={0}
                                    innerRadius={70}
                                    outerRadius={90}
                                    dataKey="value"
                                >
                                    <Cell fill="#00C49F" />
                                    <Cell fill="#e0e0e0" />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div style={{ position: 'absolute', bottom: '20px', textAlign: 'center' }}>
                            <div className="card-value">{metrics.avgDeliveryTime.toFixed(0)} min</div>
                            <div style={{ color: '#7f8c8d' }}>Avg Delivery Time</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Insights;
