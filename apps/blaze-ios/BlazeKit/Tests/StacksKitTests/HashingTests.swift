import Foundation
import Testing
@testable import StacksKit

/// Official test vectors: NIST (SHA-512/256) and the RIPEMD-160 paper
struct HashingTests {
    @Test(arguments: [
        ("", "c672b8d1ef56ed28ab87c3622c5114069bdd3ad7b8f9737498d0c01ecef0967a"),
        ("abc", "53048e2681941ef99b2e29b76b4c7dabe4c2d0c634fc6d46e0e2f13107e7af23"),
        ("abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu",
         "3928e184fb8690f840da3988121d31be65cb9d3ef83ee6146feac861e19b563a"),
    ])
    func sha512_256(input: String, expected: String) {
        #expect(SHA512_256.hash(Data(input.utf8)).hex == expected)
    }

    @Test func sha512_256OfAMillionAs() {
        let input = Data(repeating: UInt8(ascii: "a"), count: 1_000_000)
        #expect(SHA512_256.hash(input).hex == "9a59a052930187a97038cae692f30708aa6491923ef5194394dc68d56c74fb21")
    }

    @Test(arguments: [
        ("", "9c1185a5c5e9fc54612808977ee8f548b2258d31"),
        ("abc", "8eb208f7e05d987a9b044a8e98c6b087f15a0bfc"),
        ("message digest", "5d0689ef49d2fae572b881b123a85ffa21595f36"),
        ("abcdefghijklmnopqrstuvwxyz", "f71c27109c692c1b56bbdceb5b9d2865b3708dbc"),
        ("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "12a053384a9c0c88e405a06c27dcf49ada62eb2b"),
        (String(repeating: "1234567890", count: 8), "9b752e45573d4b39f4dbd3323cab82bf63326bfb"),
    ])
    func ripemd160(input: String, expected: String) {
        #expect(RIPEMD160.hash(Data(input.utf8)).hex == expected)
    }

    @Test func ripemd160OfAMillionAs() {
        let input = Data(repeating: UInt8(ascii: "a"), count: 1_000_000)
        #expect(RIPEMD160.hash(input).hex == "52783243c1697bdbe16d37f97f68f08325dc1528")
    }
}
