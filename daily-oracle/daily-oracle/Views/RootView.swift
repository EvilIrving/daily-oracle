import SwiftUI
import SwiftData

enum Tab: CaseIterable {
    case history, settings

    var title: String {
        switch self {
        case .history: "历史"
        case .settings: "设置"
        }
    }

    var icon: String {
        switch self {
        case .history: "calendar"
        case .settings: "gearshape"
        }
    }
}

struct RootView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var selectedTab: Tab = .history
    @State private var hasSeededHistory = false

    var body: some View {
        Group {
            switch selectedTab {
            case .history:
                HistoryTab()
            case .settings:
                SettingsTab()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            BottomTabBar(selectedTab: $selectedTab)
        }
        .task {
            guard !hasSeededHistory else { return }
            hasSeededHistory = true
            try? HistorySeedStore.seedIfNeeded(using: modelContext)
        }
    }
}

struct BottomTabBar: View {
    @Binding var selectedTab: Tab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases, id: \.self) { tab in
                TabBarButton(
                    tab: tab,
                    isSelected: selectedTab == tab
                ) {
                    selectedTab = tab
                }
            }
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.top, 20)
        .padding(.bottom, 0)
        .background(AppColors.backgroundPrimary)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color.black.opacity(0.05))
                .frame(height: 0.5)
        }
    }
}

private struct TabBarButton: View {
    let tab: Tab
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 5) {
                Image(systemName: tab.icon)
                    .font(.system(size: 21, weight: .regular))
                    .symbolRenderingMode(.monochrome)

                Text(tab.title)
                    .font(.system(size: 11, weight: isSelected ? .medium : .regular))
            }
            .foregroundStyle(foregroundColor)
            .frame(maxWidth: .infinity)
            .frame(height: 16)
            .offset(y: 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var foregroundColor: Color {
        isSelected ? Color.accentColor : AppColors.textTertiary
    }
}

#Preview {
    RootView()
        .modelContainer(HistorySeedStore.previewContainer())
}
