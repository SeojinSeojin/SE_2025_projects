import { useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import './Insights.css';

interface Order {
    id: string;
    totalAmount: number;
    status: string;
    createdAt: string;
    confirmedAt?: string;
    readyAt?: string;
    items: Array<{
        name: string;
        price: number;
        quantity: number;
    }>;
}

type ChartTab = 'volume' | 'revenue';

// Tooltip formatter type
const formatTooltipValue = (value: number, name: string) => {
    return [name === 'revenue' ? `$${value.toFixed(2)}` : value, name === 'revenue' ? 'Revenue' : 'Volume'];
};

const Insights: React.FC = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<ChartTab>('volume');

    const { data: orders = [], isLoading } = useQuery<Order[]>({
        queryKey: ['restaurantOrders', user?.id],
        queryFn: async () => {
            const response = await api.get(`/orders/restaurant?restaurantId=${user?.id}`);
            return response.data.orders;
        },
        enabled: !!user
    });

    const metrics = useMemo(() => {
        if (!orders.length) return null;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        // 1. Daily Revenue and Orders Fulfilled (for Today)
        const todayOrders = orders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= today && orderDate < new Date(today.getTime() + 86400000);
        });

        const dailyDeliveredOrders = todayOrders.filter(order => order.status === 'delivered');
        const dailyRevenue = dailyDeliveredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        const dailyOrdersCount = dailyDeliveredOrders.length;

        // 2. Monthly AOV and Percentage Change
        const getMonthStats = (month: number, year: number) => {
            const monthOrders = orders.filter(order => {
                const d = new Date(order.createdAt);
                return d.getMonth() === month && d.getFullYear() === year && order.status === 'delivered';
            });

            const totalRev = monthOrders.reduce((sum, order) => sum + order.totalAmount, 0);
            return {
                count: monthOrders.length,
                revenue: totalRev,
                aov: monthOrders.length ? totalRev / monthOrders.length : 0
            };
        };

        const currentMonthStats = getMonthStats(currentMonth, currentYear);
        const lastMonthStats = getMonthStats(lastMonth, lastMonthYear);

        const aovChange = lastMonthStats.aov === 0
            ? (currentMonthStats.aov > 0 ? 100 : 0)
            : ((currentMonthStats.aov - lastMonthStats.aov) / lastMonthStats.aov) * 100;

        // 3. Cancelled Orders Ratio
        const cancelledOrders = orders.filter(order => order.status === 'cancelled').length;
        const totalOrders = orders.length;
        const cancellationRatio = totalOrders ? (cancelledOrders / totalOrders) * 100 : 0;

        console.log(orders)
        // 4. Kitchen Prep Time Gauge
        const prepTimes = orders
            .filter(order => order.confirmedAt && order.readyAt)
            .map(order => {
                const confirmed = new Date(order.confirmedAt!).getTime();
                const ready = new Date(order.readyAt!).getTime();
                return (ready - confirmed) / 60000; // in minutes
            });
        console.log(prepTimes)

        const avgPrepTime = prepTimes.length
            ? prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length
            : 0;

        return {
            dailyRevenue,
            dailyOrdersCount,
            currentMonthAOV: currentMonthStats.aov,
            aovChange,
            cancelledOrders,
            totalOrders,
            cancellationRatio,
            avgPrepTime
        };
    }, [orders]);

    const chartData = useMemo(() => {
        if (!orders.length) return [];

        const productStats = new Map<string, { name: string; volume: number; revenue: number }>();

        orders.forEach(order => {
            if (order.status === 'delivered') {
                order.items.forEach(item => {
                    const existing = productStats.get(item.name) || { name: item.name, volume: 0, revenue: 0 };
                    productStats.set(item.name, {
                        name: item.name,
                        volume: existing.volume + item.quantity,
                        revenue: existing.revenue + (item.price * item.quantity)
                    });
                });
            }
        });

        const data = Array.from(productStats.values());

        // Sort and slice top 5 based on active tab
        return data
            .sort((a, b) => b[activeTab] - a[activeTab])
            .slice(0, 5);
    }, [orders, activeTab]);

    if (isLoading) return <div>Loading insights...</div>;
    if (!metrics) return <div>No data available for insights.</div>;

    const getTrendClass = (value: number) => {
        if (value > 0) return 'trend-positive';
        if (value < 0) return 'trend-negative';
        return 'trend-neutral';
    };

    const getTrendIcon = (value: number) => {
        if (value > 0) return '↑';
        if (value < 0) return '↓';
        return '•';
    };

    return (
        <div className="insights-container">
            <div className="insights-header">
                <h2>Dashboard Insights</h2>
                <p>Overview of your restaurant's performance</p>
            </div>

            <div className="insights-cards">
                {/* Card 1: Daily Revenue & Orders */}
                <div className="insight-card">
                    <div className="card-title">Today's Performance</div>
                    <div className="card-value">${metrics.dailyRevenue.toFixed(2)}</div>
                    <div className="card-subtext">
                        {metrics.dailyOrdersCount} orders fulfilled today
                    </div>
                </div>

                {/* Card 2: Monthly AOV */}
                <div className="insight-card">
                    <div className="card-title">Monthly Average Order Value</div>
                    <div className="card-value">${metrics.currentMonthAOV.toFixed(2)}</div>
                    <div className="card-subtext">
                        <span className={`trend-indicator ${getTrendClass(metrics.aovChange)}`}>
                            {getTrendIcon(metrics.aovChange)} {Math.abs(metrics.aovChange).toFixed(1)}%
                        </span>
                        <span> vs last month</span>
                    </div>
                </div>

                {/* Card 3: Cancellation Ratio */}
                <div className="insight-card">
                    <div className="card-title">Cancellation Rate</div>
                    <div className="card-value">{metrics.cancellationRatio.toFixed(1)}%</div>
                    <div className="card-subtext">
                        {metrics.cancelledOrders} cancelled / {metrics.totalOrders} total
                    </div>
                </div>
            </div>
            <div className="charts-row">
                <div className="chart-section">
                    <div className="chart-header">
                        <h3>Top Selling Products</h3>
                        <div className="chart-tabs">
                            <button
                                className={`chart-tab ${activeTab === 'volume' ? 'active' : ''}`}
                                onClick={() => setActiveTab('volume')}
                            >
                                By Volume
                            </button>
                            <button
                                className={`chart-tab ${activeTab === 'revenue' ? 'active' : ''}`}
                                onClick={() => setActiveTab('revenue')}
                            >
                                By Revenue
                            </button>
                        </div>
                    </div>

                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    interval={0}
                                    height={60}
                                    tick={{ fontSize: 12, angle: -30, textAnchor: 'end' } as any}
                                />
                                <YAxis tickFormatter={(val) => activeTab === 'revenue' ? `$${val}` : val} />
                                <Tooltip
                                    formatter={(value: number) => activeTab === 'revenue' ? [`$${value.toFixed(2)}`, 'Revenue'] : [value, 'Volume']}
                                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                />
                                <Bar
                                    dataKey={activeTab}
                                    fill={activeTab === 'volume' ? '#3498db' : '#2ecc71'}
                                    radius={[4, 4, 0, 0]}
                                    animationDuration={1000}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="gauge-section">
                    <div className="chart-header">
                        <h3>Kitchen Efficiency</h3>
                    </div>
                    <div className="gauge-container">
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={[{ value: metrics.avgPrepTime }, { value: 60 - metrics.avgPrepTime }]}
                                    cx="50%"
                                    cy="70%"
                                    startAngle={180}
                                    endAngle={0}
                                    innerRadius={70}
                                    outerRadius={90}
                                    dataKey="value"
                                >
                                    <Cell fill="#e67e22" />
                                    <Cell fill="#e0e0e0" />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="gauge-label">
                            <div className="gauge-value">{metrics.avgPrepTime.toFixed(0)} min</div>
                            <div className="gauge-text">Avg Prep Time</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Insights;
