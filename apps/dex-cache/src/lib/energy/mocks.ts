/**
 * Mock data to simulate energy logs for testing
 */
export const mockEnergyLogs = [
    {
        tx_id: "0x1234567890abcdef1",
        block_height: 100001,
        energy: 5000,
        integral: 25000,
        message: "Energy harvested",
        op: "harvest",
        sender: "SP2ABC123DEF456GHI789JKL012MNO345PQR678S",
        block_time: Date.now() / 1000 - 86400 * 7, // 7 days ago
        block_time_iso: new Date(Date.now() - 86400 * 1000 * 7).toISOString()
    },
    {
        tx_id: "0x1234567890abcdef2",
        block_height: 100010,
        energy: 7500,
        integral: 37500,
        message: "Energy harvested",
        op: "harvest",
        sender: "SP2ABC123DEF456GHI789JKL012MNO345PQR678S",
        block_time: Date.now() / 1000 - 86400 * 5, // 5 days ago
        block_time_iso: new Date(Date.now() - 86400 * 1000 * 5).toISOString()
    },
    {
        tx_id: "0x1234567890abcdef3",
        block_height: 100020,
        energy: 10000,
        integral: 50000,
        message: "Energy harvested",
        op: "harvest",
        sender: "SP2ABC123DEF456GHI789JKL012MNO345PQR678S",
        block_time: Date.now() / 1000 - 86400 * 2, // 2 days ago
        block_time_iso: new Date(Date.now() - 86400 * 1000 * 2).toISOString()
    },
    {
        tx_id: "0x1234567890abcdef4",
        block_height: 100030,
        energy: 12500,
        integral: 62500,
        message: "Energy harvested",
        op: "harvest",
        sender: "SP2XYZ123ABC456DEF789GHI012JKL345MNO678P",
        block_time: Date.now() / 1000 - 86400 * 6, // 6 days ago
        block_time_iso: new Date(Date.now() - 86400 * 1000 * 6).toISOString()
    },
    {
        tx_id: "0x1234567890abcdef5",
        block_height: 100040,
        energy: 15000,
        integral: 75000,
        message: "Energy harvested",
        op: "harvest",
        sender: "SP2XYZ123ABC456DEF789GHI012JKL345MNO678P",
        block_time: Date.now() / 1000 - 86400 * 3, // 3 days ago
        block_time_iso: new Date(Date.now() - 86400 * 1000 * 3).toISOString()
    },
    {
        tx_id: "0x1234567890abcdef6",
        block_height: 100050,
        energy: 17500,
        integral: 87500,
        message: "Energy harvested",
        op: "harvest",
        sender: "SP2XYZ123ABC456DEF789GHI012JKL345MNO678P",
        block_time: Date.now() / 1000 - 86400 * 1, // 1 day ago
        block_time_iso: new Date(Date.now() - 86400 * 1000 * 1).toISOString()
    }
];

/**
 * Calculate realistic rate values from the mock logs
 */
export const calculateMockRates = () => {
    const logs = mockEnergyLogs;

    // The earliest and latest timestamps
    const sortedLogs = [...logs].sort((a, b) => a.block_time - b.block_time);
    const firstLog = sortedLogs[0];
    const lastLog = sortedLogs[sortedLogs.length - 1];

    // Calculate timespan in minutes
    const timeSpanMinutes = (lastLog.block_time - firstLog.block_time) / 60;

    // Calculate total energy and integral
    const totalEnergy = logs.reduce((sum, log) => sum + log.energy, 0);
    const totalIntegral = logs.reduce((sum, log) => sum + log.integral, 0);

    // Calculate rates
    const energyRate = totalEnergy / timeSpanMinutes;
    const integralRate = totalIntegral / timeSpanMinutes;

    return {
        energyRate,
        integralRate
    };
}; 