import Foundation
import Testing
@testable import StacksKit

struct MnemonicTests {
    @Test func seedsMatchScureBip39() throws {
        for vector in Vectors.all.phrases {
            #expect(Mnemonic.isValid(vector.phrase))
            #expect(try Mnemonic.seed(vector.phrase).hex == vector.seed)
        }
    }

    @Test func generatesValid24WordPhrases() throws {
        let phrase = try Mnemonic.generate()
        #expect(phrase.split(separator: " ").count == 24)
        #expect(Mnemonic.isValid(phrase))
        #expect(try Mnemonic.generate() != phrase)
    }

    @Test func allZeroEntropyGivesTheStandardTestPhrases() {
        #expect(Mnemonic.phrase(entropy: Data(repeating: 0, count: 16)) == Vectors.all.phrases[0].phrase)
        #expect(Mnemonic.phrase(entropy: Data(repeating: 0, count: 32)) == Vectors.all.phrases[1].phrase)
    }

    @Test func rejectsBadPhrases() {
        let words = Vectors.all.phrases[0].phrase.split(separator: " ").map(String.init)
        // Wrong checksum word, wrong count, and a word that isn't on the list
        #expect(!Mnemonic.isValid((words.dropLast() + ["abandon"]).joined(separator: " ")))
        #expect(!Mnemonic.isValid(words.dropLast().joined(separator: " ")))
        #expect(!Mnemonic.isValid((words.dropLast() + ["wallet!"]).joined(separator: " ")))
        #expect(throws: StacksError.invalidSeedPhrase) { try Mnemonic.seed("abandon abandon") }
    }

    @Test func normalizesWhatPeopleTypeOrPaste() {
        let phrase = Vectors.all.phrases[0].phrase
        // Capitals, extra and full-width spaces, full-width letters, Turkish dotted and dotless i
        #expect(Mnemonic.normalize("  ABANDON abandon\u{3000}abandon  abandon abandon abandon abandon abandon abandon abandon abandon ａｂｏｕｔ ") == phrase)
        #expect(Mnemonic.normalize("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about") == phrase)
        #expect(Mnemonic.normalize("İnch ınch") == "inch inch")
    }
}
