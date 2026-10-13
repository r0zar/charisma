import os

/// Problems for developers, not news for the person: visible in Console.app under rocks.charisma.blazewallet
enum Log {
    static let balances = Logger(subsystem: "rocks.charisma.blazewallet", category: "balances")
    static let network = Logger(subsystem: "rocks.charisma.blazewallet", category: "network")
}
