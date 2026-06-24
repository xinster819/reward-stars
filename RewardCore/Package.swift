// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "RewardCore",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(name: "RewardCore", targets: ["RewardCore"])
    ],
    targets: [
        .target(name: "RewardCore"),
        .testTarget(name: "RewardCoreTests", dependencies: ["RewardCore"])
    ]
)
