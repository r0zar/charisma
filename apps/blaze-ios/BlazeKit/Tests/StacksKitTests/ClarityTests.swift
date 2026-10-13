import Foundation
import Testing
@testable import StacksKit

struct ClarityTests {
    @Test func serializesAndReadsLikeStacksTransactions() throws {
        for vector in Vectors.all.clarity {
            let value: ClarityValue = switch vector.name {
            case "uint", "uint-max": .uint(UInt128(vector.value!)!)
            case "ok-uint": .ok(.uint(UInt128(vector.value!)!))
            case "none": .none
            default: .principal(try Principal(vector.value!))
            }
            #expect(value.serialized.hex == vector.hex, "\(vector.name)")
            #expect(try ClarityValue(serialized: Data(hex: vector.hex)) == value, "\(vector.name)")
        }
    }

    @Test func readsBalances() throws {
        #expect(try ClarityValue(serialized: Data(hex: "01000000000000000000000000075bcd15")).uintValue == 123_456_789)
        #expect(try ClarityValue(serialized: Data(hex: "07010000000000000000000000000000002a")).uintValue == 42)
        #expect(ClarityValue.none.uintValue == nil)
    }

    @Test func rejectsWhatItDoesntRead() {
        #expect(throws: StacksError.invalidClarityValue) { try ClarityValue(serialized: Data([0x03])) }      // bool true
        #expect(throws: StacksError.invalidClarityValue) { try ClarityValue(serialized: Data([0x01, 0x00])) } // short uint
        #expect(throws: StacksError.invalidClarityValue) { try ClarityValue(serialized: Data([0x09, 0x09])) } // leftover
        // Only (ok u…): (ok none) and nested oks are refused without recursing
        #expect(throws: StacksError.invalidClarityValue) { try ClarityValue(serialized: Data([0x07, 0x09])) }
        #expect(throws: StacksError.invalidClarityValue) { try ClarityValue(serialized: Data(repeating: 0x07, count: 10_000)) }
    }
}
