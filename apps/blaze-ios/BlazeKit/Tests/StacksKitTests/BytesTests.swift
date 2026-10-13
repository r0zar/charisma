import Foundation
import Testing
@testable import StacksKit

struct BytesTests {
    @Test func hexRoundTripsAndRejectsJunk() throws {
        #expect(try Data(hex: "0x00ff10").hex == "00ff10")
        #expect(try Data(hex: "").isEmpty)
        #expect(throws: StacksError.invalidHex) { try Data(hex: "abc") }
        #expect(throws: StacksError.invalidHex) { try Data(hex: "+f") }
        #expect(throws: StacksError.invalidHex) { try Data(hex: "zz") }
        // Full-width digits count as hex digits to Swift, but aren't hex
        #expect(throws: StacksError.invalidHex) { try Data(hex: "０Ａ") }
    }

    @Test func bigEndianBytes() {
        #expect(UInt32(1).bigEndianData.hex == "00000001")
        #expect(UInt64(180).bigEndianData.hex == "00000000000000b4")
        #expect(UInt128(42).bigEndianData.hex == "0000000000000000000000000000002a")
    }

    @Test func vectorsLoad() {
        #expect(Vectors.all.phrases.count == 5)
        #expect(Vectors.all.transactions.count == 4)
    }
}
