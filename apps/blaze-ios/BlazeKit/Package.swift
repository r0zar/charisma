// swift-tools-version: 6.1
import PackageDescription

let package = Package(
    name: "BlazeKit",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [
        .library(name: "StacksKit", targets: ["StacksKit"]),
    ],
    dependencies: [
        .package(url: "https://github.com/21-DOT-DEV/swift-secp256k1", exact: "0.23.2"),
    ],
    targets: [
        .target(
            name: "StacksKit",
            dependencies: [.product(name: "P256K", package: "swift-secp256k1")]
        ),
        .testTarget(
            name: "StacksKitTests",
            dependencies: ["StacksKit"],
            resources: [.copy("vectors.json")]
        ),
    ]
)
