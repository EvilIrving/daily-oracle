import SwiftUI

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
    @State private var selectedTab: Tab = .settings

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch selectedTab {
                case .history:
                    HistoryTab()
                case .settings:
                    SettingsTab()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            FloatingTabBar(selectedTab: $selectedTab)
                .padding(.horizontal, Spacing.xl)
                .padding(.bottom, Spacing.sm)
        }
    }
}

struct FloatingTabBar: View {
    @Binding var selectedTab: Tab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases, id: \.self) { tab in
                Button {
                    selectedTab = tab
                } label: {
                    VStack(spacing: Spacing.xs) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 20))
                        Text(tab.title)
                            .font(.caption2)
                    }
                    .foregroundStyle(selectedTab == tab ? Color.accentColor : Color(.secondaryLabel))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.sm)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: Radius.lg)
                .fill(.regularMaterial)
                .shadow(color: .black.opacity(0.08), radius: 8, y: 2)
        )
    }
}

#Preview {
    RootView()
}
