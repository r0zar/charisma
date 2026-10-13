import StacksKit
import SwiftUI
import WalletCore

/// A new seed phrase: name it, write the 24 words down, confirm three of them. Nothing is saved until confirmed, so
/// no wallet ever exists with words nobody wrote down. Until then the words are kept as a draft, so leaving the app
/// (even if iOS closes it meanwhile) comes back to the same words; Cancel forgets them.
struct NewSeedFlow: View {
    let mode: SeedMode
    var onDone: () -> Void = {}

    @Environment(Vault.self) private var vault
    @Environment(\.dismiss) private var dismiss
    @State private var step = Step.name
    @State private var name = ""
    @State private var words: [String] = []
    @State private var wroteDown = false
    @State private var checks: [Int] = []
    @State private var answers: [Int: String] = [:]
    @State private var saving = false
    @State private var error: Error?

    private enum Step { case name, words, confirm }

    init(mode: SeedMode, resuming draft: SeedDraft? = nil, onDone: @escaping () -> Void = {}) {
        self.mode = mode
        self.onDone = onDone
        if let draft, draft.mode == mode {
            _step = State(initialValue: .words)
            _name = State(initialValue: draft.name)
            _words = State(initialValue: draft.words)
            _checks = State(initialValue: draft.checks)
        }
    }

    var body: some View {
        Form {
            switch step {
            case .name: nameStep
            case .words: wordsStep
            case .confirm: confirmStep
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.brand("bg"))
        .navigationTitle(step == .name ? "New seed phrase" : step == .words ? "Write these down" : "Confirm your words")
        .navigationBarTitleDisplayMode(.inline)
        // Once there are words, leaving takes Cancel, which forgets them: Back or a swipe would leave them behind
        .navigationBarBackButtonHidden(step != .name)
        .interactiveDismissDisabled(step != .name)
        .toolbar {
            if step != .name {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: cancel) }
            }
        }
    }

    @ViewBuilder private var nameStep: some View {
        Section("Name") {
            TextField("My seed phrase", text: $name)
        }
        Section {
            ErrorText(error: error)
            Button("Generate 24 words", action: generate)
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
        }
    }

    @ViewBuilder private var wordsStep: some View {
        Section {
            Text("These 24 words are the only way to recover this wallet. Anyone who sees them controls your funds, and Blaze Wallet can't recover them.")
                .foregroundStyle(.brand("warning"))
        }
        Section { SeedWordsGrid(words: words) }
        Section {
            Toggle("I wrote all 24 words down, in order", isOn: $wroteDown)
            Button("Continue") { step = .confirm }.disabled(!wroteDown)
        }
    }

    @ViewBuilder private var confirmStep: some View {
        Section {
            Text("Type these words from what you wrote down.")
        }
        ForEach(checks, id: \.self) { position in
            Section("Word #\(position)") {
                TextField(String(), text: Binding(get: { answers[position] ?? "" }, set: { answers[position] = $0 }))
                    .seedWordInput()
            }
        }
        Section {
            ErrorText(error: error)
            Button {
                Task { await save() }
            } label: {
                if saving { ProgressView() } else { Text("Confirm and save") }
            }
            .disabled(saving || checks.contains { (answers[$0] ?? "").trimmingCharacters(in: .whitespaces).isEmpty })
            Button("Back to the words") { step = .words }
        }
    }

    private func generate() {
        error = nil
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard vault.state?.seedPhrases.contains(where: { $0.name == trimmed }) != true else {
            error = WalletError.seedPhraseNameTaken(trimmed)
            return
        }
        do {
            let words = try Mnemonic.generate().split(separator: " ").map(String.init)
            // Three distinct positions, from the system's secure random generator
            let checks = Array((1...words.count).shuffled().prefix(3)).sorted()
            try vault.keep(SeedDraft(mode: mode, name: trimmed, words: words, checks: checks))
            self.words = words
            self.checks = checks
            answers = [:]
            step = .words
        } catch {
            self.error = error
        }
    }

    private func cancel() {
        do {
            try vault.keep(nil)
            dismiss()
        } catch {
            self.error = error
        }
    }

    private func save() async {
        error = nil
        let wrong = checks.filter { Mnemonic.normalize(answers[$0] ?? "") != words[$0 - 1] }
        guard wrong.isEmpty else {
            error = AppError.wordsDontMatch(wrong)
            return
        }
        saving = true
        defer { saving = false }
        do {
            try await mode.save(name: name, words: words.joined(separator: " "), in: vault)
            try vault.keep(nil)
            onDone()
        } catch VaultError.cancelled {
            // Face ID dismissed: stay here so the person can try again
        } catch {
            self.error = error
        }
    }
}
